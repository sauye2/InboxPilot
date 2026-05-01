import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailMessage } from "@/types/email";
import type { PriorityLevel, TaskState, TaskStatus, TriageMode, TriageResult, TriagedEmail } from "@/types/triage";

type ReviewActionRow = {
  action_type: string;
  email_message_id: string | null;
  created_at: string;
};

type PersistedMessageRow = {
  id: string;
  provider_message_id: string;
  provider: EmailMessage["provider"];
  thread_id: string | null;
};

export type PersistedInboxState = {
  items: TriagedEmail[];
  taskEmailIds: string[];
  taskStates: TaskState[];
};

export type TriageFeedbackRule = {
  senderEmail: string | null;
  subjectFingerprint: string | null;
  categoryOverride: string | null;
  priorityOverride: PriorityLevel | null;
};

export function providerMessageId(emailId: string) {
  return emailId;
}

export async function persistTriagedInbox({
  admin,
  userId,
  mode,
  items,
  modelProvider,
  modelName,
}: {
  admin: SupabaseClient;
  userId: string;
  mode: TriageMode;
  items: TriagedEmail[];
  modelProvider: "openai" | "local";
  modelName: string | null;
}): Promise<PersistedInboxState> {
  if (items.length === 0) {
    return { items, taskEmailIds: [], taskStates: [] };
  }

  const connectionIds = await getConnectionIds(admin, userId);
  const messageRows = items.map(({ email }) => ({
    user_id: userId,
    connection_id: connectionIds.get(email.provider) ?? null,
    provider: email.provider,
    provider_message_id: providerMessageId(email.id),
    thread_id: email.threadId,
    sender_name: email.senderName,
    sender_email: email.senderEmail,
    subject: email.subject,
    snippet: email.snippet,
    body: email.provider === "mock" ? email.body : null,
    body_retained: email.provider === "mock",
    received_at: email.receivedAt,
    is_read: email.isRead,
    labels: email.labels,
    metadata: { inboxpilotEmailId: email.id },
    updated_at: new Date().toISOString(),
  }));

  const { data: savedMessages, error: messageError } = await admin
    .from("email_messages")
    .upsert(messageRows, {
      onConflict: "user_id,provider,provider_message_id",
    })
    .select("id, provider_message_id, provider, thread_id");

  if (messageError) {
    throw new Error(messageError.message);
  }

  const messageByProviderId = new Map(
    ((savedMessages ?? []) as PersistedMessageRow[]).map((message) => [
      message.provider_message_id,
      message.id,
    ]),
  );

  const triageRows = items.map(({ email, triage }) => ({
    user_id: userId,
    email_message_id: messageByProviderId.get(providerMessageId(email.id)) ?? null,
    mode,
    priority: triage.priority,
    category: triage.category,
    requires_action: triage.requiresAction,
    deadline_text: triage.deadline,
    deadline_at: parseDeadlineAt(triage.deadline),
    action_summary: triage.actionSummary,
    suggested_next_action: triage.suggestedNextAction,
    reason: triage.reason,
    confidence: triage.confidence,
    model_provider: modelProvider,
    model_name: modelName,
    source: modelProvider === "openai" ? "openai" : "local_rules",
    raw_model_response: null,
  }));

  const { error: triageError } = await admin
    .from("triage_results")
    .insert(triageRows)
    .select("id");

  if (triageError) {
    throw new Error(triageError.message);
  }

  const reviewState = await getReviewStateForMessages(
    admin,
    userId,
    [...messageByProviderId.values()],
  );
  const taskState = await syncTaskStateForMessages({
    admin,
    userId,
    items,
    messages: (savedMessages ?? []) as PersistedMessageRow[],
    messageByProviderId,
  });

  return {
    items: items.map((item) => {
      const messageId = messageByProviderId.get(providerMessageId(item.email.id));
      const state = messageId ? reviewState.byMessageId.get(messageId) : undefined;

      return {
        ...item,
        triage: {
          ...item.triage,
          reviewed: state?.reviewed ?? item.triage.reviewed,
          pinned: state?.pinned ?? item.triage.pinned,
          snoozedUntil: state?.snoozedUntil ?? item.triage.snoozedUntil,
        },
      };
    }),
    taskEmailIds: taskState.taskStates
      .filter((task) => task.status !== "archived")
      .map((task) => task.emailId),
    taskStates: taskState.taskStates,
  };
}

export async function findPersistedEmailMessage(
  admin: SupabaseClient,
  userId: string,
  emailId: string,
) {
  const { data, error } = await admin
    .from("email_messages")
    .select(
      "id, provider, provider_message_id, thread_id, sender_name, sender_email, subject, snippet, body, received_at, is_read, labels",
    )
    .eq("user_id", userId)
    .eq("provider_message_id", providerMessageId(emailId))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    dbId: data.id as string,
    email: {
      id: data.provider_message_id as string,
      provider: data.provider as EmailMessage["provider"],
      senderName: (data.sender_name as string | null) ?? "Unknown sender",
      senderEmail: (data.sender_email as string | null) ?? "unknown@example.com",
      subject: (data.subject as string | null) ?? "(No subject)",
      body: ((data.body as string | null) ?? (data.snippet as string | null) ?? ""),
      snippet: (data.snippet as string | null) ?? "",
      receivedAt: data.received_at as string,
      isRead: Boolean(data.is_read),
      labels: (data.labels as string[] | null) ?? [],
      threadId: (data.thread_id as string | null) ?? data.provider_message_id,
    },
  };
}

export async function auditProviderEvent({
  admin,
  userId,
  connectionId = null,
  provider,
  eventType,
  message = null,
}: {
  admin: SupabaseClient;
  userId: string;
  connectionId?: string | null;
  provider: EmailMessage["provider"];
  eventType:
    | "refresh_success"
    | "refresh_failed"
    | "fetch_failed"
    | "revoked"
    | "send_success"
    | "send_failed"
    | "trash_success"
    | "trash_failed";
  message?: string | null;
}) {
  await admin.from("provider_token_audit_events").insert({
    user_id: userId,
    connection_id: connectionId,
    provider,
    event_type: eventType,
    message,
  });
}

export async function recordReviewAction({
  admin,
  userId,
  emailId,
  actionType,
  snoozedUntil = null,
}: {
  admin: SupabaseClient;
  userId: string;
  emailId: string;
  actionType:
    | "reviewed"
    | "unreviewed"
    | "pinned"
    | "unpinned"
    | "snoozed"
    | "unsnoozed"
    | "hidden"
    | "task_created";
  snoozedUntil?: string | null;
}) {
  const persisted = await findPersistedEmailMessage(admin, userId, emailId);

  if (!persisted) {
    throw new Error("Run Scan before saving this action.");
  }

  const { data: triage } = await admin
    .from("triage_results")
    .select("id")
    .eq("user_id", userId)
    .eq("email_message_id", persisted.dbId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("review_actions").insert({
    user_id: userId,
    email_message_id: persisted.dbId,
    triage_result_id: (triage?.id as string | undefined) ?? null,
    action_type: actionType,
    snoozed_until: snoozedUntil,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (actionType === "task_created") {
    await upsertTaskForEmail({
      admin,
      userId,
      emailId,
      status: "to_reply",
    });
  }
}

export async function upsertTaskForEmail({
  admin,
  userId,
  emailId,
  status,
}: {
  admin: SupabaseClient;
  userId: string;
  emailId: string;
  status: TaskStatus;
}) {
  const persisted = await findPersistedEmailMessage(admin, userId, emailId);

  if (!persisted) {
    throw new Error("Run Scan before saving this task.");
  }

  const { data: triage } = await admin
    .from("triage_results")
    .select("id, suggested_next_action, deadline_at")
    .eq("user_id", userId)
    .eq("email_message_id", persisted.dbId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("tasks").upsert(
    {
      user_id: userId,
      email_message_id: persisted.dbId,
      triage_result_id: (triage?.id as string | undefined) ?? null,
      title: (triage?.suggested_next_action as string | undefined) ?? persisted.email.subject,
      status,
      due_at: (triage?.deadline_at as string | null | undefined) ?? null,
      provider: persisted.email.provider,
      provider_message_id: providerMessageId(persisted.email.id),
      provider_thread_id: persisted.email.threadId,
      last_inbound_at: persisted.email.receivedAt,
    },
    { onConflict: "user_id,email_message_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateTaskForEmail({
  admin,
  userId,
  emailId,
  status,
  draftSubject,
  draftBody,
  lastOutboundAt,
}: {
  admin: SupabaseClient;
  userId: string;
  emailId: string;
  status?: TaskStatus;
  draftSubject?: string | null;
  draftBody?: string | null;
  lastOutboundAt?: string | null;
}) {
  const persisted = await findPersistedEmailMessage(admin, userId, emailId);

  if (!persisted) {
    throw new Error("Run Scan before updating this task.");
  }

  const patch: Record<string, string | null> = {};
  if (status) patch.status = status;
  if (draftSubject !== undefined) patch.draft_subject = draftSubject;
  if (draftBody !== undefined) {
    patch.draft_body = draftBody;
    patch.draft_updated_at = new Date().toISOString();
  }
  if (lastOutboundAt !== undefined) patch.last_outbound_at = lastOutboundAt;

  const { error } = await admin
    .from("tasks")
    .update(patch)
    .eq("user_id", userId)
    .eq("email_message_id", persisted.dbId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createTriageFeedbackRule({
  admin,
  userId,
  emailId,
  mode,
  categoryOverride,
  priorityOverride,
}: {
  admin: SupabaseClient;
  userId: string;
  emailId: string;
  mode: TriageMode;
  categoryOverride?: string | null;
  priorityOverride?: PriorityLevel | null;
}) {
  const persisted = await findPersistedEmailMessage(admin, userId, emailId);

  if (!persisted) {
    throw new Error("Run Scan before saving feedback.");
  }

  const { error } = await admin.from("triage_feedback_rules").upsert(
    {
      user_id: userId,
      mode,
      sender_email: persisted.email.senderEmail.toLowerCase(),
      subject_fingerprint: subjectFingerprint(persisted.email.subject),
      category_override: categoryOverride ?? null,
      priority_override: priorityOverride ?? null,
    },
    { onConflict: "user_id,mode,sender_email,subject_fingerprint" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getTriageFeedbackRules(
  admin: SupabaseClient,
  userId: string,
  mode: TriageMode,
) {
  const { data, error } = await admin
    .from("triage_feedback_rules")
    .select("sender_email, subject_fingerprint, category_override, priority_override")
    .eq("user_id", userId)
    .eq("mode", mode);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    sender_email: string | null;
    subject_fingerprint: string | null;
    category_override: string | null;
    priority_override: PriorityLevel | null;
  }>).map((row) => ({
    senderEmail: row.sender_email,
    subjectFingerprint: row.subject_fingerprint,
    categoryOverride: row.category_override,
    priorityOverride: row.priority_override,
  }));
}

export function applyTriageFeedbackRules(
  item: TriagedEmail,
  mode: TriageMode,
  rules: TriageFeedbackRule[],
) {
  const sender = item.email.senderEmail.toLowerCase();
  const subject = subjectFingerprint(item.email.subject);
  const rule = rules.find(
    (candidate) =>
      candidate.senderEmail === sender &&
      candidate.subjectFingerprint === subject,
  );

  if (!rule) return item;

  return {
    ...item,
    triage: {
      ...item.triage,
      category: rule.categoryOverride ?? item.triage.category,
      priority: rule.priorityOverride ?? item.triage.priority,
      requiresAction:
        rule.categoryOverride === "Inbox Noise" ? false : item.triage.requiresAction,
      reason: `${item.triage.reason} Personal ${mode} feedback applied.`,
      source: undefined,
    },
  } as TriagedEmail;
}

async function getConnectionIds(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("email_connections")
    .select("id, provider")
    .eq("user_id", userId)
    .eq("status", "connected");

  return new Map(
    ((data ?? []) as Array<{ id: string; provider: string }>).map((connection) => [
      connection.provider,
      connection.id,
    ]),
  );
}

async function getReviewStateForMessages(
  admin: SupabaseClient,
  userId: string,
  messageIds: string[],
) {
  const byMessageId = new Map<
    string,
    Pick<TriageResult, "reviewed" | "pinned" | "snoozedUntil">
  >();
  const taskMessageIds = new Set<string>();

  if (messageIds.length === 0) {
    return { byMessageId, taskMessageIds };
  }

  const { data, error } = await admin
    .from("review_actions")
    .select("action_type, email_message_id, created_at")
    .eq("user_id", userId)
    .in("email_message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  for (const action of (data ?? []) as ReviewActionRow[]) {
    if (!action.email_message_id) continue;

    const current = byMessageId.get(action.email_message_id) ?? {
      reviewed: false,
      pinned: false,
      snoozedUntil: null,
    };

    if (action.action_type === "reviewed") current.reviewed = true;
    if (action.action_type === "unreviewed") current.reviewed = false;
    if (action.action_type === "pinned") current.pinned = true;
    if (action.action_type === "unpinned") current.pinned = false;
    if (action.action_type === "unsnoozed") current.snoozedUntil = null;
    if (action.action_type === "task_created") {
      taskMessageIds.add(action.email_message_id);
    }

    byMessageId.set(action.email_message_id, current);
  }

  return { byMessageId, taskMessageIds };
}

async function syncTaskStateForMessages({
  admin,
  userId,
  items,
  messages,
  messageByProviderId,
}: {
  admin: SupabaseClient;
  userId: string;
  items: TriagedEmail[];
  messages: PersistedMessageRow[];
  messageByProviderId: Map<string, string>;
}) {
  const messageIds = [...messageByProviderId.values()];
  const threadKeys = new Set(
    messages
      .filter((message) => message.thread_id)
      .map((message) => `${message.provider}:${message.thread_id}`),
  );

  if (messageIds.length === 0 && threadKeys.size === 0) {
    return { taskStates: [] as TaskState[] };
  }

  const { data: connections } = await admin
    .from("email_connections")
    .select("provider, provider_account_email")
    .eq("user_id", userId)
    .eq("status", "connected");
  const accountByProvider = new Map(
    ((connections ?? []) as Array<{ provider: string; provider_account_email: string | null }>).map(
      (connection) => [connection.provider, connection.provider_account_email?.toLowerCase() ?? ""],
    ),
  );

  const newestInboundByThread = new Map<string, TriagedEmail>();
  for (const item of items) {
    const accountEmail = accountByProvider.get(item.email.provider) ?? "";
    const isInbound = item.email.senderEmail.toLowerCase() !== accountEmail;
    if (!item.email.threadId || !isInbound) continue;

    const key = `${item.email.provider}:${item.email.threadId}`;
    const current = newestInboundByThread.get(key);
    if (!current || new Date(item.email.receivedAt) > new Date(current.email.receivedAt)) {
      newestInboundByThread.set(key, item);
    }
  }

  const rows: Array<{
    id: string;
    email_message_id: string | null;
    provider: string | null;
    provider_thread_id: string | null;
    status: TaskStatus;
    draft_subject: string | null;
    draft_body: string | null;
    last_outbound_at: string | null;
  }> = [];

  if (messageIds.length > 0) {
    const { data, error } = await admin
      .from("tasks")
      .select("id, email_message_id, provider, provider_thread_id, status, draft_subject, draft_body, last_outbound_at")
      .eq("user_id", userId)
      .in("email_message_id", messageIds);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as typeof rows));
  }

  for (const key of threadKeys) {
    const [provider, threadId] = key.split(":");
    const { data, error } = await admin
      .from("tasks")
      .select("id, email_message_id, provider, provider_thread_id, status, draft_subject, draft_body, last_outbound_at")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("provider_thread_id", threadId)
      .eq("status", "waiting");

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data ?? []) as typeof rows) {
      if (!rows.some((existing) => existing.id === row.id)) {
        rows.push(row);
      }
    }
  }

  for (const task of rows) {
    if (task.status !== "waiting" || !task.provider || !task.provider_thread_id) continue;
    const newest = newestInboundByThread.get(`${task.provider}:${task.provider_thread_id}`);
    if (!newest) continue;
    const newerThanOutbound =
      !task.last_outbound_at || new Date(newest.email.receivedAt) > new Date(task.last_outbound_at);

    if (newerThanOutbound && newest.triage.requiresAction) {
      await admin
        .from("tasks")
        .update({
          status: "to_reply",
          last_inbound_at: newest.email.receivedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      task.status = "to_reply";
    }
  }

  const messageIdToEmailId = new Map(
    [...messageByProviderId.entries()].map(([emailId, dbId]) => [dbId, emailId]),
  );
  const threadToEmailId = new Map(
    items.map((item) => [`${item.email.provider}:${item.email.threadId}`, item.email.id]),
  );

  return {
    taskStates: rows
      .map((task) => {
        const emailId =
          (task.email_message_id ? messageIdToEmailId.get(task.email_message_id) : null) ??
          (task.provider && task.provider_thread_id
            ? threadToEmailId.get(`${task.provider}:${task.provider_thread_id}`)
            : null);
        if (!emailId) return null;
        return {
          emailId,
          status: task.status,
          draftSubject: task.draft_subject,
          draftBody: task.draft_body,
        };
      })
      .filter(Boolean) as TaskState[],
  };
}

function parseDeadlineAt(deadline: string | null) {
  if (!deadline) return null;
  const timestamp = Date.parse(deadline);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function subjectFingerprint(subject: string) {
  return subject
    .toLowerCase()
    .replace(/\bre:\s*/g, "")
    .replace(/\b(fwd?|fw):\s*/g, "")
    .replace(/\d{1,4}([/-]\d{1,2}){1,2}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

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

type PersistedTaskRow = {
  id: string;
  email_message_id: string | null;
  title: string | null;
  status: TaskStatus;
  provider: EmailMessage["provider"] | null;
  provider_message_id: string | null;
  provider_thread_id: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  last_inbound_at: string | null;
  updated_at: string;
};

type PersistedEmailRow = {
  id: string;
  provider: EmailMessage["provider"];
  provider_message_id: string;
  thread_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  received_at: string;
  is_read: boolean;
  labels: string[] | null;
};

type TaskSaveValues = {
  triageResultId?: string | null;
  title?: string | null;
  status?: TaskStatus;
  dueAt?: string | null;
  draftSubject?: string | null;
  draftBody?: string | null;
  draftUpdatedAt?: string | null;
  lastOutboundAt?: string | null;
};

type PersistedTriageRow = {
  email_message_id: string | null;
  priority: PriorityLevel;
  category: string;
  requires_action: boolean;
  deadline_text: string | null;
  action_summary: string | null;
  suggested_next_action: string | null;
  reason: string | null;
  confidence: number | null;
};

export type TriageFeedbackRule = {
  senderEmail: string | null;
  subjectFingerprint: string | null;
  categoryOverride: string | null;
  priorityOverride: PriorityLevel | null;
};

export type PriorThreadTriage = {
  category: string;
  priority: PriorityLevel;
  requiresAction: boolean;
  deadline: string | null;
};

export function providerMessageId(emailId: string) {
  return emailId;
}

export async function getPersistedTasks({
  admin,
  userId,
  provider,
}: {
  admin: SupabaseClient;
  userId: string;
  provider?: EmailMessage["provider"];
}): Promise<PersistedInboxState> {
  const taskQuery = admin
    .from("tasks")
    .select("id, email_message_id, title, status, provider, provider_message_id, provider_thread_id, draft_subject, draft_body, last_inbound_at, updated_at")
    .eq("user_id", userId)
    .neq("status", "archived");

  const { data: taskRows, error: taskError } = await taskQuery.order("updated_at", {
    ascending: false,
  });

  if (taskError) {
    throw new Error(taskError.message);
  }

  const tasks = (taskRows ?? []) as PersistedTaskRow[];
  const messageIds = tasks
    .map((task) => task.email_message_id)
    .filter(Boolean) as string[];
  const providerMessageIds = tasks
    .map((task) => task.provider_message_id)
    .filter(Boolean) as string[];

  if (tasks.length === 0) {
    return { items: [], taskEmailIds: [], taskStates: [] };
  }

  const messageRows: PersistedEmailRow[] = [];

  if (messageIds.length > 0) {
    const { data, error } = await admin
      .from("email_messages")
      .select("id, provider, provider_message_id, thread_id, sender_name, sender_email, subject, snippet, body, received_at, is_read, labels")
      .eq("user_id", userId)
      .in("id", messageIds);

    if (error) {
      throw new Error(error.message);
    }

    messageRows.push(...((data ?? []) as PersistedEmailRow[]));
  }

  if (providerMessageIds.length > 0) {
    const { data, error } = await admin
      .from("email_messages")
      .select("id, provider, provider_message_id, thread_id, sender_name, sender_email, subject, snippet, body, received_at, is_read, labels")
      .eq("user_id", userId)
      .in("provider_message_id", providerMessageIds);

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data ?? []) as PersistedEmailRow[]) {
      if (!messageRows.some((message) => message.id === row.id)) {
        messageRows.push(row);
      }
    }
  }

  const triageMessageIds = [...new Set(messageRows.map((message) => message.id))];
  let triageRows: PersistedTriageRow[] = [];

  if (triageMessageIds.length > 0) {
    const { data, error } = await admin
      .from("triage_results")
      .select("email_message_id, priority, category, requires_action, deadline_text, action_summary, suggested_next_action, reason, confidence, created_at")
      .eq("user_id", userId)
      .in("email_message_id", triageMessageIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    triageRows = (data ?? []) as PersistedTriageRow[];
  }

  const messageById = new Map(
    messageRows.map((message) => [message.id, message]),
  );
  const messageByProviderMessageId = new Map(
    messageRows.map((message) => [`${message.provider}:${message.provider_message_id}`, message]),
  );
  const triageByMessageId = new Map<string, PersistedTriageRow>();

  for (const triage of triageRows) {
    if (triage.email_message_id && !triageByMessageId.has(triage.email_message_id)) {
      triageByMessageId.set(triage.email_message_id, triage);
    }
  }

  const getMessageForTask = (task: PersistedTaskRow) => {
    if (task.email_message_id) {
      const message = messageById.get(task.email_message_id);
      if (message) return message;
    }

    if (task.provider && task.provider_message_id) {
      return messageByProviderMessageId.get(`${task.provider}:${task.provider_message_id}`) ?? null;
    }

    return null;
  };

  const items = tasks
    .map((task) => {
      const message = getMessageForTask(task);
      const taskProvider = message?.provider ?? task.provider;
      if (provider && taskProvider !== provider) return null;
      const triage = message?.id ? triageByMessageId.get(message.id) : undefined;
      const emailId = message?.provider_message_id ?? task.provider_message_id ?? task.email_message_id ?? task.id;
      const fallbackText =
        message?.snippet ??
        message?.subject ??
        task.draft_subject ??
        task.title ??
        "Review this saved email.";

      return {
        email: {
          id: emailId,
          provider: taskProvider ?? "gmail",
          senderName: message?.sender_name ?? "Saved email",
          senderEmail: message?.sender_email ?? "saved-email@inboxpilot.local",
          subject: message?.subject ?? task.title ?? "(Saved email)",
          body: message?.body ?? fallbackText,
          snippet: message?.snippet ?? fallbackText,
          receivedAt: message?.received_at ?? task.last_inbound_at ?? task.updated_at,
          isRead: Boolean(message?.is_read ?? true),
          labels: message?.labels ?? [],
          threadId: message?.thread_id ?? task.provider_thread_id ?? emailId,
        },
        triage: {
          emailId,
          priority: triage?.priority ?? "medium",
          category: triage?.category ?? "Inbox Noise",
          requiresAction: triage?.requires_action ?? true,
          deadline: triage?.deadline_text ?? null,
          actionSummary: triage?.action_summary ?? fallbackText,
          reason: triage?.reason ?? "Saved as a task.",
          confidence: Number(triage?.confidence ?? 0),
          suggestedNextAction: triage?.suggested_next_action ?? task.draft_subject ?? fallbackText,
          reviewed: task.status === "done",
          pinned: false,
          snoozedUntil: null,
        },
      } satisfies TriagedEmail;
    })
    .filter(Boolean) as TriagedEmail[];

  const itemByEmailId = new Map(items.map((item) => [item.email.id, item]));

  return {
    items,
    taskEmailIds: items.map((item) => item.email.id),
    taskStates: tasks
      .map((task) => {
        const message = getMessageForTask(task);
        const taskProvider = message?.provider ?? task.provider;
        if (provider && taskProvider !== provider) return null;
        const emailId = message?.provider_message_id ?? task.provider_message_id ?? task.email_message_id ?? task.id;
        if (!itemByEmailId.has(emailId)) return null;
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

export async function getPriorThreadTriageMap({
  admin,
  userId,
  mode,
  emails,
}: {
  admin: SupabaseClient;
  userId: string;
  mode: TriageMode;
  emails: EmailMessage[];
}) {
  const byCurrentEmailId = new Map<string, PriorThreadTriage>();
  const threadsByProvider = new Map<EmailMessage["provider"], Set<string>>();

  for (const email of emails) {
    if (!email.threadId) continue;
    const set = threadsByProvider.get(email.provider) ?? new Set<string>();
    set.add(email.threadId);
    threadsByProvider.set(email.provider, set);
  }

  for (const [provider, threadIds] of threadsByProvider.entries()) {
    const { data: messageRows, error: messageError } = await admin
      .from("email_messages")
      .select("id, provider_message_id, thread_id")
      .eq("user_id", userId)
      .eq("provider", provider)
      .in("thread_id", [...threadIds]);

    if (messageError) {
      throw new Error(messageError.message);
    }

    const messages = (messageRows ?? []) as Array<{
      id: string;
      provider_message_id: string;
      thread_id: string | null;
    }>;
    const messageIds = messages.map((message) => message.id);

    if (messageIds.length === 0) continue;

    const { data: triageRows, error: triageError } = await admin
      .from("triage_results")
      .select("email_message_id, category, priority, requires_action, deadline_text, created_at")
      .eq("user_id", userId)
      .eq("mode", mode)
      .in("email_message_id", messageIds)
      .order("created_at", { ascending: false });

    if (triageError) {
      throw new Error(triageError.message);
    }

    const threadByMessageId = new Map(messages.map((message) => [message.id, message.thread_id]));
    const bestByThread = new Map<string, PriorThreadTriage>();

    for (const triage of (triageRows ?? []) as Array<{
      email_message_id: string | null;
      category: string;
      priority: PriorityLevel;
      requires_action: boolean;
      deadline_text: string | null;
    }>) {
      if (!triage.email_message_id) continue;
      const threadId = threadByMessageId.get(triage.email_message_id);
      if (!threadId || bestByThread.has(threadId)) continue;

      if (triage.category === "Inbox Noise") {
        const hasBetterPrior = (triageRows ?? []).some((candidate) => {
          const candidateRow = candidate as {
            email_message_id: string | null;
            category: string;
          };
          return (
            candidateRow.email_message_id &&
            threadByMessageId.get(candidateRow.email_message_id) === threadId &&
            candidateRow.category !== "Inbox Noise"
          );
        });
        if (hasBetterPrior) continue;
      }

      bestByThread.set(threadId, {
        category: triage.category,
        priority: triage.priority,
        requiresAction: triage.requires_action,
        deadline: triage.deadline_text,
      });
    }

    for (const email of emails) {
      if (email.provider !== provider || !email.threadId) continue;
      const prior = bestByThread.get(email.threadId);
      if (prior) {
        byCurrentEmailId.set(email.id, prior);
      }
    }
  }

  return byCurrentEmailId;
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
    | "archive_success"
    | "archive_failed"
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

  await saveTaskForPersistedEmail({
    admin,
    userId,
    persisted,
    values: {
      triageResultId: (triage?.id as string | undefined) ?? null,
      title: (triage?.suggested_next_action as string | undefined) ?? persisted.email.subject,
      status,
      dueAt: (triage?.deadline_at as string | null | undefined) ?? null,
    },
  });
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

  await saveTaskForPersistedEmail({
    admin,
    userId,
    persisted,
    values: {
      title: persisted.email.subject,
      status,
      draftSubject,
      draftBody,
      draftUpdatedAt: draftBody !== undefined ? new Date().toISOString() : undefined,
      lastOutboundAt,
    },
  });
}

async function saveTaskForPersistedEmail({
  admin,
  userId,
  persisted,
  values,
}: {
  admin: SupabaseClient;
  userId: string;
  persisted: NonNullable<Awaited<ReturnType<typeof findPersistedEmailMessage>>>;
  values: TaskSaveValues;
}) {
  const now = new Date().toISOString();
  const base = {
    user_id: userId,
    email_message_id: persisted.dbId,
    title: values.title ?? persisted.email.subject,
    provider: persisted.email.provider,
    provider_message_id: providerMessageId(persisted.email.id),
    provider_thread_id: persisted.email.threadId,
    last_inbound_at: persisted.email.receivedAt,
    updated_at: now,
  };

  const optionalPatch: Record<string, string | null> = {};
  if (values.triageResultId !== undefined) optionalPatch.triage_result_id = values.triageResultId;
  if (values.dueAt !== undefined) optionalPatch.due_at = values.dueAt;
  if (values.draftSubject !== undefined) optionalPatch.draft_subject = values.draftSubject;
  if (values.draftBody !== undefined) optionalPatch.draft_body = values.draftBody;
  if (values.draftUpdatedAt !== undefined) optionalPatch.draft_updated_at = values.draftUpdatedAt;
  if (values.lastOutboundAt !== undefined) optionalPatch.last_outbound_at = values.lastOutboundAt;

  const existing = await findExistingTaskForPersistedEmail(admin, userId, persisted);

  if (existing?.id) {
    const updatePayload: Record<string, string | null> = {
      ...base,
      ...optionalPatch,
    };
    if (values.status !== undefined) updatePayload.status = values.status;

    const { error } = await admin
      .from("tasks")
      .update(updatePayload)
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const insertPayload: Record<string, string | null> = {
    ...base,
    ...optionalPatch,
    status: values.status ?? "to_reply",
  };

  const { error } = await admin.from("tasks").insert(insertPayload);

  if (error) {
    throw new Error(error.message);
  }
}

async function findExistingTaskForPersistedEmail(
  admin: SupabaseClient,
  userId: string,
  persisted: NonNullable<Awaited<ReturnType<typeof findPersistedEmailMessage>>>,
) {
  const { data: exactTask, error: exactError } = await admin
    .from("tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("email_message_id", persisted.dbId)
    .maybeSingle();

  if (exactError) {
    throw new Error(exactError.message);
  }

  if (exactTask) {
    return exactTask as { id: string };
  }

  if (!persisted.email.threadId) return null;

  const { data: threadTask, error: threadError } = await admin
    .from("tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", persisted.email.provider)
    .eq("provider_thread_id", persisted.email.threadId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (threadError) {
    throw new Error(threadError.message);
  }

  return (threadTask as { id: string } | null) ?? null;
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
      const newestMessageId = messageByProviderId.get(providerMessageId(newest.email.id)) ?? null;
      await admin
        .from("tasks")
        .update({
          email_message_id: newestMessageId,
          status: "to_reply",
          last_inbound_at: newest.email.receivedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      task.email_message_id = newestMessageId;
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
    .replace(/[“"][^”"]{2,120}[”"]/g, "")
    .replace(/\b\d{1,3}%\s*(?:match|off|discount)?\b/g, "")
    .replace(/\d{1,4}([/-]\d{1,2}){1,2}/g, "")
    .replace(/\b(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g, "")
    .replace(/\b(?:latest|new|top|recommended|matches?|jobs?|roles?|alerts?|update|available|posted)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

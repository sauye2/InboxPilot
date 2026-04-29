import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailMessage } from "@/types/email";
import type { TriageMode, TriageResult, TriagedEmail } from "@/types/triage";

type ReviewActionRow = {
  action_type: string;
  email_message_id: string | null;
  created_at: string;
};

type PersistedMessageRow = {
  id: string;
  provider_message_id: string;
};

export type PersistedInboxState = {
  items: TriagedEmail[];
  taskEmailIds: string[];
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
    return { items, taskEmailIds: [] };
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
    metadata: {
      inboxpilotEmailId: email.id,
    },
    updated_at: new Date().toISOString(),
  }));

  const { data: savedMessages, error: messageError } = await admin
    .from("email_messages")
    .upsert(messageRows, {
      onConflict: "user_id,provider,provider_message_id",
    })
    .select("id, provider_message_id");

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
    taskEmailIds: items
      .filter((item) => {
        const messageId = messageByProviderId.get(providerMessageId(item.email.id));
        return Boolean(messageId && reviewState.taskMessageIds.has(messageId));
      })
      .map((item) => item.email.id),
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

function parseDeadlineAt(deadline: string | null) {
  if (!deadline) return null;
  const timestamp = Date.parse(deadline);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

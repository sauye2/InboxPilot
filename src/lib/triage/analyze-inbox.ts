import type { EmailMessage } from "@/types/email";
import type { InboxSummary, TriageMode, TriageResult, TriagedEmail } from "@/types/triage";
import { analyzeEmail } from "@/lib/triage/analyze-email";
import { priorityWeights } from "@/lib/triage/rules";

export function analyzeInbox(
  emails: EmailMessage[],
  mode: TriageMode,
  reviewState: Record<string, Partial<TriageResult>> = {},
): { items: TriagedEmail[]; summary: InboxSummary } {
  const items = emails
    .map((email) => ({
      email,
      triage: analyzeEmail(email, mode, reviewState[email.id]),
    }))
    .sort(compareTriagedEmail);

  return {
    items,
    summary: summarizeInbox(items),
  };
}

export function compareTriagedEmail(a: TriagedEmail, b: TriagedEmail) {
  if (a.triage.pinned !== b.triage.pinned) {
    return a.triage.pinned ? -1 : 1;
  }

  const priorityDelta =
    priorityWeights[b.triage.priority] - priorityWeights[a.triage.priority];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const urgencyDelta = contextualUrgencyScore(b) - contextualUrgencyScore(a);

  if (urgencyDelta !== 0) {
    return urgencyDelta;
  }

  if (a.triage.deadline && !b.triage.deadline) return -1;
  if (!a.triage.deadline && b.triage.deadline) return 1;

  return (
    new Date(b.email.receivedAt).getTime() - new Date(a.email.receivedAt).getTime()
  );
}

function contextualUrgencyScore(item: TriagedEmail) {
  const text = [
    item.triage.category,
    item.triage.suggestedNextAction,
    item.email.senderName,
    item.email.senderEmail,
    item.email.subject,
    item.email.snippet,
    item.email.body,
  ]
    .join(" ")
    .toLowerCase();

  let score = item.triage.requiresAction ? 2 : 0;

  const categoryWeights: Record<string, number> = {
    Urgent: 9,
    Manager: 8,
    Interviews: 8,
    "Job Offers": 8,
    Finance: 7,
    Clients: 7,
    "Online Assessment": 6,
    Documents: 5,
    Meetings: 5,
    Applications: 4,
    Events: 2,
    Reservations: 2,
    Purchases: 1,
    "Inbox Noise": -8,
  };

  score += categoryWeights[item.triage.category] ?? 0;

  const weightedSignals: Array<[RegExp, number]> = [
    [/\b(security|password|2fa|two-factor|sign-in|unusual|suspicious)\b/, 9],
    [/\b(bank|card|transaction|payment|invoice|late fee|bill)\b/, 8],
    [/\b(boss|manager|lead|client|blocked|approval|approve|sign-off)\b/, 8],
    [/\b(interview|offer|recruiter|assessment|take-home)\b/, 7],
    [/\b(deadline|asap|urgent|tomorrow|today|due)\b/, 5],
    [/\b(meeting|calendar|availability)\b/, 4],
    [/\b(dinner|plans|reservation|event|ticket|invite|invitation)\b/, 2],
    [/\b(newsletter|digest|highlights|hiring alert|job alert)\b/, -6],
  ];

  for (const [pattern, weight] of weightedSignals) {
    if (pattern.test(text)) {
      score += weight;
    }
  }

  return score;
}

export function summarizeInbox(items: TriagedEmail[]): InboxSummary {
  const topCategoryMap = new Map<string, number>();

  for (const item of items) {
    topCategoryMap.set(
      item.triage.category,
      (topCategoryMap.get(item.triage.category) ?? 0) + 1,
    );
  }

  return {
    totalEmails: items.length,
    actionRequiredCount: items.filter((item) => item.triage.requiresAction).length,
    highPriorityCount: items.filter((item) => item.triage.priority === "high").length,
    upcomingDeadlineCount: items.filter((item) => item.triage.deadline).length,
    unreadImportantCount: items.filter(
      (item) => !item.email.isRead && item.triage.priority !== "low",
    ).length,
    topCategories: [...topCategoryMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4),
  };
}

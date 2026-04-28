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

  if (a.triage.deadline && !b.triage.deadline) return -1;
  if (!a.triage.deadline && b.triage.deadline) return 1;

  return (
    new Date(b.email.receivedAt).getTime() - new Date(a.email.receivedAt).getTime()
  );
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

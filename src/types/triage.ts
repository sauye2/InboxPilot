export type TriageMode = "job_search" | "work" | "life_admin";

export type PriorityLevel = "high" | "medium" | "low";

export type TriageCategory = string;

export type SortOption = "priority" | "deadline" | "newest";

export type TriageResult = {
  emailId: string;
  priority: PriorityLevel;
  category: TriageCategory;
  requiresAction: boolean;
  deadline: string | null;
  actionSummary: string;
  reason: string;
  confidence: number;
  suggestedNextAction: string;
  reviewed: boolean;
  pinned: boolean;
  snoozedUntil: string | null;
};

export type TaskStatus = "to_reply" | "waiting" | "done" | "archived";

export type TaskState = {
  emailId: string;
  status: TaskStatus;
  draftSubject: string | null;
  draftBody: string | null;
};

export type TriagedEmail = {
  email: import("./email").EmailMessage;
  triage: TriageResult;
};

export type InboxSummary = {
  totalEmails: number;
  actionRequiredCount: number;
  highPriorityCount: number;
  upcomingDeadlineCount: number;
  unreadImportantCount: number;
  topCategories: Array<{ category: string; count: number }>;
};

export type ModeDefinition = {
  id: TriageMode;
  label: string;
  shortLabel: string;
  description: string;
  categories: string[];
};

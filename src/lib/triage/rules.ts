import type { PriorityLevel, TriageMode } from "@/types/triage";

export const priorityWeights: Record<PriorityLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const actionPhrases = [
  "please respond",
  "please reply",
  "action required",
  "confirm",
  "approve",
  "review",
  "send",
  "sign",
  "verify",
  "availability",
  "reply if",
  "needed",
  "needs",
];

export const urgentPhrases = [
  "urgent",
  "asap",
  "deadline",
  "due",
  "blocked",
  "waiting on",
  "final sign-off",
  "avoid a late fee",
];

export const modeCategoryKeywords: Record<TriageMode, Record<string, string[]>> = {
  job_search: {
    Interviews: ["interview", "panel", "availability", "technical"],
    Applications: ["application", "status update", "candidate"],
    "Job Offers": ["offer", "compensation", "benefits", "signing"],
    "Online Assessment": ["assessment", "take-home", "coding exercise", "react exercise"],
    Recruiters: ["recruiter", "recruiting", "talent", "careers"],
    Urgent: ["urgent", "asap", "deadline"],
    "Inbox Noise": ["no action is required", "another candidate", "not moving forward", "decided to move forward"],
  },
  work: {
    Meetings: ["meeting", "agenda", "calendar", "3 pm", "noon"],
    Manager: ["manager", "jordan", "boss", "lead"],
    Urgent: ["urgent", "blocked", "asap", "waiting", "approve", "approval", "sign-off", "deadline", "due", "by tomorrow", "by thursday"],
    Clients: ["client", "stakeholder", "northwind"],
    Documents: ["document", "brief", "agreement", "attached", "review"],
    "Project Updates": ["status", "project"],
    "Inbox Noise": ["digest", "no action is required", "on track"],
  },
  life_admin: {
    Urgent: ["urgent", "asap", "unusual", "secure", "clinic", "medical", "appointment", "dermatology"],
    Purchases: ["order", "purchase", "receipt", "package", "delivery", "tracking", "signature"],
    Reservations: ["reservation", "confirmed for", "cancel"],
    Events: ["event", "reminder", "ticket"],
    Finance: ["bank", "card", "transaction", "account", "bill", "invoice", "late fee", "payment"],
    Documents: ["document", "sign", "paperwork", "forms"],
    "Inbox Noise": ["no signature is required", "confirmed", "no action is required"],
  },
};

export function scoreToPriority(score: number): PriorityLevel {
  if (score >= 7) {
    return "high";
  }

  if (score >= 4) {
    return "medium";
  }

  return "low";
}

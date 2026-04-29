import type { EmailMessage } from "@/types/email";
import type { TriageMode, TriageResult } from "@/types/triage";
import {
  actionPhrases,
  modeCategoryKeywords,
  scoreToPriority,
  urgentPhrases,
} from "@/lib/triage/rules";
import { detectDeadline } from "@/lib/triage/deadline";

export function analyzeEmail(
  email: EmailMessage,
  mode: TriageMode,
  reviewState?: Partial<Pick<TriageResult, "reviewed" | "pinned" | "snoozedUntil">>,
): TriageResult {
  const text = `${email.senderName} ${email.senderEmail} ${email.subject} ${email.body} ${email.labels.join(
    " ",
  )}`.toLowerCase();
  const deadline = detectDeadline(text);
  const actionHits = actionPhrases.filter((phrase) => text.includes(phrase));
  const urgentHits = urgentPhrases.filter((phrase) => text.includes(phrase));
  const category = detectCategory(text, mode);

  let score = 1;
  score += actionHits.length > 0 ? 2 : 0;
  score += urgentHits.length > 0 ? 2 : 0;
  score += deadline ? 2 : 0;
  score += deadline && actionHits.length > 0 ? 1 : 0;
  score += email.isRead ? 0 : 1;
  score += modeSpecificBoost(text, mode, category);

  if (text.includes("no action is required")) {
    score -= 2;
  }

  if (category === "Inbox Noise") {
    score -= 1;
  }

  const priority = scoreToPriority(score);
  const requiresAction =
    actionHits.length > 0 && !text.includes("no action is required");
  const confidence = Math.min(0.96, 0.58 + actionHits.length * 0.06 + urgentHits.length * 0.05 + (deadline ? 0.12 : 0));

  return {
    emailId: email.id,
    priority,
    category,
    requiresAction,
    deadline,
    actionSummary: buildActionSummary(category, requiresAction, deadline),
    reason: buildReason({ requiresAction, deadline, urgentHits, category, priority }),
    confidence: Number(confidence.toFixed(2)),
    suggestedNextAction: buildSuggestedNextAction(category, requiresAction, deadline, text),
    reviewed: reviewState?.reviewed ?? false,
    pinned: reviewState?.pinned ?? false,
    snoozedUntil: reviewState?.snoozedUntil ?? null,
  };
}

function detectCategory(text: string, mode: TriageMode) {
  const map = modeCategoryKeywords[mode];
  let bestCategory = Object.keys(map)[0];
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(map)) {
    const score = keywords.reduce(
      (total, keyword) => total + (text.includes(keyword) ? 1 : 0),
      0,
    );

    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestScore === 0 ? "Inbox Noise" : bestCategory;
}

function modeSpecificBoost(text: string, mode: TriageMode, category: string) {
  if (mode === "job_search") {
    return ["Interviews", "Offers", "Assessments", "Deadlines", "Urgent"].includes(category)
      ? 2
      : text.includes("recruiter")
        ? 1
        : 0;
  }

  if (mode === "work") {
    return ["Manager", "Approvals", "Clients", "Deadlines", "Urgent"].includes(category) ? 2 : 0;
  }

  return ["Bills", "Medical", "Finance", "Urgent", "Needs Reply"].includes(category)
    ? 2
    : category === "Events"
      ? 1
      : 0;
}

function buildActionSummary(category: string, requiresAction: boolean, deadline: string | null) {
  if (!requiresAction) {
    return `Monitor ${category.toLowerCase()} item; no immediate response detected.`;
  }

  return deadline
    ? `${category}: respond or complete the requested step by ${deadline}.`
    : `${category}: respond or complete the requested step.`;
}

function buildReason(input: {
  requiresAction: boolean;
  deadline: string | null;
  urgentHits: string[];
  category: string;
  priority: string;
}) {
  const signals = [];

  if (input.requiresAction) signals.push("asks for action");
  if (input.deadline) signals.push(`mentions ${input.deadline}`);
  if (input.urgentHits.length > 0) signals.push("contains urgency language");

  if (signals.length === 0) {
    return `Ranked ${input.priority} because it matches ${input.category} but has no strong action signal.`;
  }

  return `Ranked ${input.priority} because it ${signals.join(", ")}.`;
}

function buildSuggestedNextAction(
  category: string,
  requiresAction: boolean,
  deadline: string | null,
  text: string,
) {
  if (!requiresAction) {
    return category === "Inbox Noise"
      ? "No action needed."
      : "Review when convenient.";
  }

  if (text.includes("offer")) {
    return deadline
      ? `Review and accept the offer by ${deadline}.`
      : "Review and respond to the offer.";
  }

  if (text.includes("interview") && text.includes("availability")) {
    return deadline
      ? `Reply with your availability by ${deadline}.`
      : "Confirm your availability for the interview.";
  }

  if (text.includes("assessment") || text.includes("take-home")) {
    return deadline
      ? `Complete the online assessment by ${deadline}.`
      : "Complete the online assessment.";
  }

  if (text.includes("approve") || text.includes("approval")) {
    return deadline
      ? `Review and approve by ${deadline}.`
      : "Review and approve the request.";
  }

  if (text.includes("verify")) {
    return "Verify the requested account activity.";
  }

  if (text.includes("bill") || text.includes("payment")) {
    return deadline ? `Pay or schedule the bill by ${deadline}.` : "Review the bill.";
  }

  if (category === "Events" && deadline) {
    return `Respond with your availability for ${deadline}.`;
  }

  if (deadline) {
    return `Complete the requested action by ${deadline}.`;
  }

  return `Handle the ${category.toLowerCase()} request.`;
}

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
  const detectedCategory = detectCategory(text, mode);
  const category = refineCategoryForMode(text, mode, detectedCategory);
  const relevantToMode = category !== "Inbox Noise";
  const passiveJobAlert = mode === "job_search" && isPassiveJobAlert(text);

  let score = 1;
  score += actionHits.length > 0 ? 2 : 0;
  score += urgentHits.length > 0 ? 2 : 0;
  score += passiveJobAlert ? -2 : 0;
  score += email.isRead ? 0 : 1;
  score += modeSpecificBoost(text, mode, category);

  if (text.includes("no action is required")) {
    score -= 2;
  }

  if (category === "Inbox Noise") {
    score -= relevantToMode ? 1 : 4;
  }

  const requiresAction =
    relevantToMode &&
    !passiveJobAlert &&
    actionHits.length > 0 &&
    !text.includes("no action is required");
  const effectiveDeadline = normalizeDeadlineForTriage(text, mode, category, deadline);
  score += effectiveDeadline ? 2 : 0;
  score += effectiveDeadline && actionHits.length > 0 ? 1 : 0;
  const priority = enforceDeadlinePriority(scoreToPriority(score), effectiveDeadline, requiresAction);
  const confidence = Math.min(0.96, 0.58 + actionHits.length * 0.06 + urgentHits.length * 0.05 + (effectiveDeadline ? 0.12 : 0));

  return {
    emailId: email.id,
    priority,
    category,
    requiresAction,
    deadline: effectiveDeadline,
    actionSummary: buildActionSummary(category, requiresAction, effectiveDeadline),
    reason: buildReason({ requiresAction, deadline: effectiveDeadline, urgentHits, category, priority }),
    confidence: Number(confidence.toFixed(2)),
    suggestedNextAction: buildSuggestedNextAction(category, requiresAction, effectiveDeadline, text),
    reviewed: reviewState?.reviewed ?? false,
    pinned: reviewState?.pinned ?? false,
    snoozedUntil: reviewState?.snoozedUntil ?? null,
  };
}

export function isRelevantToMode(text: string, mode: TriageMode, category: string) {
  return refineCategoryForMode(text, mode, category) !== "Inbox Noise";
}

export function refineCategoryForMode(text: string, mode: TriageMode, category: string) {
  const normalized = text.toLowerCase();

  if (mode === "job_search") {
    if (isAuthCodeNoise(normalized) || isNonJobTooling(normalized)) return "Inbox Noise";
    if (isPassiveJobAlert(normalized)) return "Recruiters";
    if (category === "Inbox Noise") return "Inbox Noise";
    if (isJobSearchText(normalized)) return category;
    return "Inbox Noise";
  }

  if (category === "Inbox Noise") return "Inbox Noise";

  if (mode === "work") {
    if (
      isJobSearchText(normalized) ||
      isPassiveJobAlert(normalized) ||
      isAuthCodeNoise(normalized) ||
      isPromotionalNoise(normalized) ||
      isPersonalFinance(normalized) ||
      isPersonalPurchase(normalized)
    ) {
      return "Inbox Noise";
    }
    if (isVibeCodingWork(normalized)) return "Project Updates";
    if (category === "Manager" && !/\b(manager|boss|lead|director|supervisor)\b/.test(normalized)) {
      return "Inbox Noise";
    }
    if (category === "Clients" && !/\b(client|stakeholder|customer|account team)\b/.test(normalized)) {
      return "Inbox Noise";
    }
    if (isWorkText(normalized)) return category;
    return "Inbox Noise";
  }

  if (isJobSearchText(normalized) || isPromotionalNoise(normalized) || isAuthCodeNoise(normalized)) {
    return "Inbox Noise";
  }

  if (category === "Purchases") {
    return isActualPurchase(normalized) ? "Purchases" : "Inbox Noise";
  }

  if (category === "Finance") {
    return isPersonalFinance(normalized) ? "Finance" : "Inbox Noise";
  }

  if (category === "Events") {
    return isRealEvent(normalized) ? "Events" : "Inbox Noise";
  }

  return isLifeText(normalized) ? category : "Inbox Noise";
}

function isJobSearchText(text: string) {
  return [
      /\b(job|career|careers|recruiter|recruiting|talent|candidate|application|applied|interview|assessment|take-home|coding exercise|role|position)\b/,
      /\b(offer|compensation|benefits)\b.*\b(job|role|position|candidate|employment|start date)\b/,
      /\b(software engineer|product engineer|internship|intern)\b/,
      /\b(hiring|job alert|jobs you might like|match from|remote role)\b/,
    ].some((pattern) => pattern.test(text));
}

export function normalizeDeadlineForTriage(
  text: string,
  mode: TriageMode,
  category: string,
  deadline: string | null,
) {
  if (category === "Inbox Noise") return null;
  if (mode === "job_search" && isPassiveJobAlert(text)) return null;
  return deadline;
}

export function isPassiveJobAlert(text: string) {
  return [
    /\b(job alert|job alerts|jobs you might like|hiring for|is hiring|match from|posted a .* match|new job listing)\b/,
    /\b(latest|remote|backend|frontend|software|application developer|engineer|developer).*\bjobright\b/,
    /\blinkedin\b.*\b(is hiring|remote role|job alerts?)\b/,
  ].some((pattern) => pattern.test(text));
}

function isWorkText(text: string) {
  return [
    /\b(work|workplace|manager|boss|lead|team|client|stakeholder|project|approval|approve|brief|document|meeting|agenda|calendar invite|blocked|sign-off|status update)\b/,
    /\b(q[1-4]|launch|roadmap|sprint|standup|pull request|deployment|production|build failed|incident|repository)\b/,
    /\b(vercel|supabase|github|linear|jira)\b.*\b(project|deployment|production|build|database|security vulnerabilities|row-level security|repository)\b/,
  ].some((pattern) => pattern.test(text));
}

function isLifeText(text: string) {
  return [
    /\b(bank|card|transaction|payment|bill|invoice|repayment|loan|debt|credit|collection|security|password|sign-in|appointment|clinic|medical|doctor|dentist|order|delivery|package|reservation|event|ticket|dinner|invite|invitation|rsvp|travel|flight|hotel|form|forms|document|sign|paperwork)\b/,
    /\b(are you available|let me know|plans|this friday|tomorrow|today)\b/,
  ].some((pattern) => pattern.test(text));
}

function isPromotionalNoise(text: string) {
  if (isJobSearchText(text)) return false;
  return [
    /\b(promo|promotion|promotional|newsletter|digest|highlights|sale|discount|save up to|final hours|upgrade|pro plan|subscribe|unsubscribe|limited time|eligible for an interest rate reduction)\b/,
    /\b(activate your .* benefit|new features?|what'?s new|just dropped)\b/,
  ].some((pattern) => pattern.test(text));
}

function isAuthCodeNoise(text: string) {
  return /\b(otp|one[- ]time code|verification code|login code|security code|request for otp)\b/.test(text);
}

function isActualPurchase(text: string) {
  if (isPromotionalNoise(text) || isJobSearchText(text)) return false;
  return [
    /\b(receipt|order confirmation|order number|purchase confirmation|payment receipt|parking receipt)\b/,
    /\b(shipped|shipping|delivery|tracking|package|delivered|return label)\b/,
    /\b(thank you for your order|your order|your purchase)\b/,
  ].some((pattern) => pattern.test(text));
}

function isPersonalFinance(text: string) {
  if (isPromotionalNoise(text)) return false;
  return [
    /\b(bank|credit card|debit card|transaction|payment|bill|invoice|repayment|loan|debt|credit and collection|collections|auto pay|statement|tax|refund)\b/,
    /\b(aidvantage|federal student aid|chase|coinbase|atlas bank|nationwide credit)\b.*\b(payment|account|transaction|debt|repayment|loan|statement)\b/,
  ].some((pattern) => pattern.test(text));
}

function isRealEvent(text: string) {
  if (isPromotionalNoise(text)) return false;
  return [
    /\b(dinner|lunch|plans|rsvp|invite|invitation|are you available|let me know|reservation|appointment)\b/,
    /\b(event|ticket|concert|show|game|flight|hotel)\b.*\b(confirmed|confirmation|upcoming|reminder|starts|scheduled|reservation)\b/,
  ].some((pattern) => pattern.test(text));
}

function isPersonalPurchase(text: string) {
  return isActualPurchase(text) || /\b(order|purchase|receipt|package|delivery|tracking)\b/.test(text);
}

function isVibeCodingWork(text: string) {
  if (/\b(signup|sign up|confirm your signup|authentication|auth|otp|one[- ]time code)\b/.test(text)) {
    return false;
  }
  return /\b(vercel|supabase|github)\b.*\b(project|deployment|production|build|database|row-level security|security vulnerabilities|repository)\b/.test(
    text,
  );
}

function isNonJobTooling(text: string) {
  return /\b(vercel|supabase|github|chatgpt|openai|g2g|ubisoft|coinbase|aidvantage|chase)\b/.test(text);
}

function enforceDeadlinePriority(
  priority: TriageResult["priority"],
  deadline: string | null,
  requiresAction: boolean,
) {
  if (!deadline) return priority;
  if (priority === "low") return "medium";
  if (
    requiresAction &&
    /\b(today|tomorrow|this|friday|thursday|wednesday|tuesday|monday|saturday|sunday|asap|soon)\b/i.test(
      deadline,
    )
  ) {
    return "high";
  }
  return priority;
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

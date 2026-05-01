import type { EmailMessage } from "@/types/email";
import type { PriorityLevel, TriageMode, TriageResult } from "@/types/triage";
import {
  analyzeEmail,
  isPassiveJobAlert,
  normalizeDeadlineForTriage,
  refineCategoryForMode,
} from "@/lib/triage/analyze-email";
import { getModeDefinition } from "@/lib/triage/modes";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

export type TriageService = {
  analyzeEmail(email: EmailMessage, mode: TriageMode): Promise<TriageResult>;
};

export class LocalTriageService implements TriageService {
  async analyzeEmail(email: EmailMessage, mode: TriageMode) {
    return analyzeEmail(email, mode);
  }
}

const triageSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  category: z.string().min(1),
  requiresAction: z.boolean(),
  deadline: z.string().nullable(),
  actionSummary: z.string().min(1).max(180),
  reason: z.string().min(1).max(220),
  confidence: z.number().min(0).max(1),
  suggestedNextAction: z.string().min(1).max(160),
});

type OpenAITriageResponse = z.infer<typeof triageSchema>;

export class OpenAITriageService implements TriageService {
  private client: OpenAI;
  private model: string;
  private fallback = new LocalTriageService();

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_TRIAGE_MODEL ?? "gpt-5.4-mini";
  }

  async analyzeEmail(email: EmailMessage, mode: TriageMode): Promise<TriageResult> {
    const localResult = await this.fallback.analyzeEmail(email, mode);
    const modeDefinition = getModeDefinition(mode);

    const response = await withRateLimitRetry(() =>
      this.client.responses.parse({
        model: this.model,
        input: [
          {
            role: "system",
            content:
              "You classify confidential emails for InboxPilot. Return brief, practical triage only. Do not invent facts. Choose the best category from the allowed categories based on the email's real intent, not only literal keywords. Be strict about mode relevance: when an email does not belong to the selected mode, use Inbox Noise, requiresAction false, no deadline, low priority. In Recruiting mode, passive job listing alerts from LinkedIn, Jobright, or similar senders belong in Recruiters, not Applications, and they should not have a deadline unless the email explicitly says apply/respond/complete by a date. Promotional emails, newsletters, sale/discount offers, upgrade prompts, feature announcements, job alerts outside Recruiting, and auth/OTP codes outside a directly relevant workflow are Inbox Noise. Purchases must be actual receipts, order confirmations, shipping, tracking, delivery, or purchased service notices, not promotional discounts. Finance must be real financial account, debt, repayment, bill, payment, statement, transaction, or collection messages. Events must be real plans, invitations, reservations, tickets, appointments, or upcoming events, not promotional announcements. Working mode should only contain workplace/team/client/manager/project emails; Vercel/Supabase/GitHub project/deployment/security-project emails may be Project Updates, but signup/auth/OTP/promotional emails are Inbox Noise. Deadlines, due dates, event dates, availability requests, RSVP requests, forms to submit, documents to sign, and any requested reply must raise priority only when the email is mode-relevant.",
          },
          {
            role: "user",
            content: JSON.stringify({
              mode: modeDefinition.shortLabel,
              allowedCategories: modeDefinition.categories,
              relevancePolicy:
                "If the email is not relevant to the selected mode, classify it as Inbox Noise even if it has deadlines or actions. Recruiting mode should only include job search/recruiting/application/interview/offer/assessment emails. Working mode should only include workplace, team, manager, client, meeting, project, approval, document-review, or coding-project operations emails. Living mode should include personal admin, finance, appointments, actual purchases, reservations, events, travel, security, documents, and personal replies. Promo and marketing emails are Inbox Noise unless they confirm a real existing purchase/reservation/event.",
              email: {
                senderName: email.senderName,
                senderEmail: email.senderEmail,
                subject: truncateForPrompt(email.subject, 220),
                snippet: truncateForPrompt(email.snippet, 700),
                body: truncateForPrompt(email.body, 2200),
                receivedAt: email.receivedAt,
                isRead: email.isRead,
                labels: email.labels.slice(0, 8),
              },
            }),
          },
        ],
        text: {
          format: zodTextFormat(triageSchema, "inboxpilot_email_triage"),
          verbosity: "low",
        },
        max_output_tokens: 450,
      }),
    );

    const parsed = response.output_parsed as OpenAITriageResponse | null;

    if (!parsed) {
      return localResult;
    }

    return normalizeTriageResult({
      parsed,
      localResult,
      mode,
      email,
      emailId: email.id,
      allowedCategories: modeDefinition.categories,
    });
  }
}

function normalizeTriageResult({
  parsed,
  localResult,
  mode,
  email,
  emailId,
  allowedCategories,
}: {
  parsed: OpenAITriageResponse;
  localResult: TriageResult;
  mode: TriageMode;
  email: EmailMessage;
  emailId: string;
  allowedCategories: string[];
}): TriageResult {
  const text = [
    email.senderName,
    email.senderEmail,
    email.subject,
    email.snippet,
    email.body,
    email.labels.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const parsedCategoryAllowed = allowedCategories.includes(parsed.category);
  const deadline = parsed.deadline ?? localResult.deadline;
  const requiresAction = parsed.requiresAction || localResult.requiresAction;
  const parsedCategoryLooksLikeNoise = parsed.category === "Inbox Noise";
  const localHasUsefulCategory =
    localResult.category !== "Inbox Noise" && allowedCategories.includes(localResult.category);
  const candidateCategory =
    !parsedCategoryAllowed ||
    (parsedCategoryLooksLikeNoise && (deadline || requiresAction) && localHasUsefulCategory)
      ? localResult.category
      : parsed.category;
  const category = refineCategoryForMode(text, mode, candidateCategory);
  const relevantToMode = category !== "Inbox Noise";
  const passiveJobAlert = mode === "job_search" && isPassiveJobAlert(text);
  const effectiveDeadline = relevantToMode
    ? normalizeDeadlineForTriage(text, mode, category, deadline)
    : null;
  const effectiveRequiresAction = relevantToMode && !passiveJobAlert && requiresAction;
  const priority = enforceDeadlinePriority({
    priority: relevantToMode && !passiveJobAlert ? parsed.priority : "low",
    deadline: effectiveDeadline,
    requiresAction: effectiveRequiresAction,
  });

  return {
      ...localResult,
      ...parsed,
      emailId,
      priority,
      category: relevantToMode ? category : "Inbox Noise",
      requiresAction: effectiveRequiresAction,
      deadline: effectiveDeadline,
      reviewed: localResult.reviewed,
      pinned: localResult.pinned,
      snoozedUntil: localResult.snoozedUntil,
    };
}

function enforceDeadlinePriority({
  priority,
  deadline,
  requiresAction,
}: {
  priority: PriorityLevel;
  deadline: string | null;
  requiresAction: boolean;
}): PriorityLevel {
  if (!deadline) return priority;

  if (priority === "low") {
    return "medium";
  }

  if (requiresAction && isSoonDeadline(deadline)) {
    return "high";
  }

  return priority;
}

function isSoonDeadline(deadline: string) {
  return /\b(today|tomorrow|this|friday|thursday|wednesday|tuesday|monday|saturday|sunday|asap|soon)\b/i.test(
    deadline,
  );
}

export function createTriageService() {
  if (!process.env.OPENAI_API_KEY) {
    return new LocalTriageService();
  }

  return new OpenAITriageService();
}

async function withRateLimitRetry<T>(operation: () => Promise<T>) {
  const delays = [1000, 2500, 5000];

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRateLimitError(error) || attempt === delays.length) {
        throw error;
      }

      await sleep(getRetryDelay(error) ?? delays[attempt]);
    }
  }

  return operation();
}

function isRateLimitError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const status = "status" in error ? error.status : null;
  const message = "message" in error ? String(error.message) : "";
  return status === 429 || /rate limit|tokens per min|tpm/i.test(message);
}

function getRetryDelay(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) return null;

  const match = String(error.message).match(/try again in\s+(\d+)ms/i);
  return match ? Number(match[1]) + 300 : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateForPrompt(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

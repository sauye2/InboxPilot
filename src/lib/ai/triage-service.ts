import type { EmailMessage } from "@/types/email";
import type { PriorityLevel, TriageMode, TriageResult } from "@/types/triage";
import { analyzeEmail, isRelevantToMode } from "@/lib/triage/analyze-email";
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

    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        {
          role: "system",
          content:
            "You classify confidential emails for InboxPilot. Return brief, practical triage only. Do not invent facts. Choose the best category from the allowed categories based on the email's real intent, not only literal keywords. Deadlines, due dates, event dates, availability requests, RSVP requests, forms to submit, documents to sign, and any requested reply must raise priority. Any email with a real upcoming deadline or requested response should be at least medium priority; make it high when the deadline is soon, the sender/subject is important, or the action affects work, recruiting, finance, health, security, travel, reservations, or plans. High priority can include non-emergency emails that need a response soon; rank true security, financial, work blockers, boss/manager messages, interviews, offers, and approvals above casual plans. In Life mode, invitations, reservations, concerts, dinners, appointments, and plans belong in Events unless they are pure promotion. If an email asks whether the user is available for a day/date, include that deadline and mark requiresAction true.",
        },
        {
          role: "user",
          content: JSON.stringify({
            mode: modeDefinition.shortLabel,
            allowedCategories: modeDefinition.categories,
            relevancePolicy:
              "If the email is not relevant to the selected mode, classify it as Inbox Noise even if it has deadlines or actions. Recruiting mode should only include job search/recruiting/application/interview/offer/assessment emails. Working mode should only include workplace, team, manager, client, meeting, project, approval, or document-review emails. Living mode should include personal admin, finance, appointments, purchases, reservations, events, travel, security, documents, and personal replies.",
            email: {
              senderName: email.senderName,
              senderEmail: email.senderEmail,
              subject: email.subject,
              snippet: email.snippet,
              body: email.body,
              receivedAt: email.receivedAt,
              isRead: email.isRead,
              labels: email.labels,
            },
          }),
        },
      ],
      text: {
        format: zodTextFormat(triageSchema, "inboxpilot_email_triage"),
        verbosity: "low",
      },
      max_output_tokens: 700,
    });

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
  const category =
    !parsedCategoryAllowed ||
    (parsedCategoryLooksLikeNoise && (deadline || requiresAction) && localHasUsefulCategory)
      ? localResult.category
      : parsed.category;
  const relevantToMode = isRelevantToMode(text, mode, category);
  const priority = enforceDeadlinePriority({
    priority: relevantToMode ? parsed.priority : "low",
    deadline,
    requiresAction: relevantToMode && requiresAction,
  });

  return {
      ...localResult,
      ...parsed,
      emailId,
      priority,
      category: relevantToMode ? category : "Inbox Noise",
      requiresAction: relevantToMode && requiresAction,
      deadline,
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

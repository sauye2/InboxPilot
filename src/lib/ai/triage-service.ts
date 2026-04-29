import type { EmailMessage } from "@/types/email";
import type { TriageMode, TriageResult } from "@/types/triage";
import { analyzeEmail } from "@/lib/triage/analyze-email";
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
            "You classify confidential emails for InboxPilot. Return brief, practical triage only. Do not invent facts. Prefer concise task wording. Deadlines and requested replies should raise priority even for personal events. High priority can include non-emergency emails that need a response soon; rank true security, financial, work blockers, and interviews above casual plans. In Life mode, invitations, reservations, concerts, dinners, appointments, and plans belong in Events unless they are pure promotion. If an email asks availability for Friday or another nearby day, include that deadline and mark requiresAction true.",
        },
        {
          role: "user",
          content: JSON.stringify({
            mode: modeDefinition.shortLabel,
            allowedCategories: modeDefinition.categories,
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

    return {
      ...localResult,
      ...parsed,
      emailId: email.id,
      reviewed: localResult.reviewed,
      pinned: localResult.pinned,
      snoozedUntil: localResult.snoozedUntil,
    };
  }
}

export function createTriageService() {
  if (!process.env.OPENAI_API_KEY) {
    return new LocalTriageService();
  }

  return new OpenAITriageService();
}

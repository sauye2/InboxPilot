import type { EmailMessage } from "@/types/email";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const replySuggestionSchema = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(1200),
  tone: z.enum(["concise", "professional", "warm", "firm"]),
  caveats: z.array(z.string()).max(4),
});

export type ReplySuggestion = z.infer<typeof replySuggestionSchema>;

export type ReplyTone = ReplySuggestion["tone"];

export class OpenAIReplyService {
  private client: OpenAI;
  private model: string;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_REPLY_MODEL ?? "gpt-5.4-mini";
  }

  async suggestReply(email: EmailMessage, tone: ReplyTone = "professional") {
    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        {
          role: "system",
          content:
            "Draft a helpful email reply. Use a professional email format with greeting, concise body, and signoff on separate lines. Do not claim the user completed actions they have not confirmed. Keep the reply concise and ready to edit. Use [Your Name] as the signature placeholder unless the user's name is explicit.",
        },
        {
          role: "user",
          content: JSON.stringify({
            requestedTone: tone,
            email: {
              senderName: email.senderName,
              senderEmail: email.senderEmail,
              subject: email.subject,
              body: email.body,
              snippet: email.snippet,
            },
          }),
        },
      ],
      text: {
        format: zodTextFormat(replySuggestionSchema, "inboxpilot_reply_suggestion"),
        verbosity: "low",
      },
      max_output_tokens: 900,
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI did not return a valid reply suggestion.");
    }

    return response.output_parsed;
  }
}

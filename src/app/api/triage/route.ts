import { NextResponse } from "next/server";
import { z } from "zod";
import { createTriageService, LocalTriageService } from "@/lib/ai/triage-service";
import { compareTriagedEmail, summarizeInbox } from "@/lib/triage/analyze-inbox";
import type { EmailMessage } from "@/types/email";

const emailSchema = z.object({
  id: z.string(),
  provider: z.enum(["mock", "gmail", "outlook", "yahoo"]),
  senderName: z.string(),
  senderEmail: z.string(),
  subject: z.string(),
  body: z.string(),
  snippet: z.string(),
  receivedAt: z.string(),
  isRead: z.boolean(),
  labels: z.array(z.string()),
  threadId: z.string(),
});

const triageRequestSchema = z.object({
  mode: z.enum(["job_search", "work", "life_admin"]),
  emails: z.array(emailSchema).min(1).max(25),
  useOpenAI: z.boolean().default(true),
});

export async function POST(request: Request) {
  const payload = triageRequestSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid triage request.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const { emails, mode, useOpenAI } = payload.data;
  const service = useOpenAI ? createTriageService() : new LocalTriageService();
  const items = await Promise.all(
    emails.map(async (email) => ({
      email: email as EmailMessage,
      triage: await service.analyzeEmail(email as EmailMessage, mode),
    })),
  );

  items.sort(compareTriagedEmail);

  return NextResponse.json({
    provider: useOpenAI && process.env.OPENAI_API_KEY ? "openai" : "local",
    items,
    summary: summarizeInbox(items),
  });
}

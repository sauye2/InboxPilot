import { NextResponse } from "next/server";
import { z } from "zod";
import { createTriageService, LocalTriageService } from "@/lib/ai/triage-service";
import { compareTriagedEmail, summarizeInbox } from "@/lib/triage/analyze-inbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { persistTriagedInbox } from "@/lib/supabase/triage-persistence";
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
  emails: z.array(emailSchema).min(1).max(50),
  useOpenAI: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Sign in before running cloud triage." },
        { status: 401 },
      );
    }

    const payload = triageRequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid triage request.", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const { emails, mode, useOpenAI } = payload.data;
    const service = useOpenAI ? createTriageService() : new LocalTriageService();
    const provider = useOpenAI && process.env.OPENAI_API_KEY ? "openai" : "local";
    const items = await Promise.all(
      emails.map(async (email) => ({
        email: email as EmailMessage,
        triage: await service.analyzeEmail(email as EmailMessage, mode),
      })),
    );

    items.sort(compareTriagedEmail);
    const persisted = await persistTriagedInbox({
      admin: createSupabaseAdminClient(),
      userId: user.id,
      mode,
      items,
      modelProvider: provider,
      modelName: provider === "openai" ? process.env.OPENAI_TRIAGE_MODEL ?? "gpt-5.4-mini" : null,
    });

    return NextResponse.json({
      provider,
      items: persisted.items,
      summary: summarizeInbox(persisted.items),
      taskEmailIds: persisted.taskEmailIds,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run scan. Please try again.",
      },
      { status: 500 },
    );
  }
}

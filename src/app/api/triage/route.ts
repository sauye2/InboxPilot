import { NextResponse } from "next/server";
import { z } from "zod";
import { createTriageService, LocalTriageService } from "@/lib/ai/triage-service";
import { compareTriagedEmail, summarizeInbox } from "@/lib/triage/analyze-inbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  applyTriageFeedbackRules,
  getTriageFeedbackRules,
  persistTriagedInbox,
} from "@/lib/supabase/triage-persistence";
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
    const admin = createSupabaseAdminClient();
    const service = useOpenAI ? createTriageService() : new LocalTriageService();
    const provider = useOpenAI && process.env.OPENAI_API_KEY ? "openai" : "local";
    const concurrency = provider === "openai" ? getOpenAIConcurrency() : 8;
    const feedbackRules = await getTriageFeedbackRules(admin, user.id, mode);
    const items = await mapWithConcurrency(emails, concurrency, async (email) => ({
        email: email as EmailMessage,
        triage: await service.analyzeEmail(email as EmailMessage, mode),
      })).then((triaged) =>
        triaged.map((item) => applyTriageFeedbackRules(item, mode, feedbackRules)),
      );

    items.sort(compareTriagedEmail);
    const persisted = await persistTriagedInbox({
      admin,
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
      taskStates: persisted.taskStates,
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

function getOpenAIConcurrency() {
  const parsed = Number(process.env.OPENAI_TRIAGE_CONCURRENCY ?? 2);

  if (!Number.isFinite(parsed)) return 2;
  return Math.max(1, Math.min(4, Math.floor(parsed)));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

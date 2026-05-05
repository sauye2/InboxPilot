import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createTriageService,
  LocalTriageService,
  type TriageService,
} from "@/lib/ai/triage-service";
import { compareTriagedEmail, summarizeInbox } from "@/lib/triage/analyze-inbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  applyTriageFeedbackRules,
  getPriorThreadTriageMap,
  getTriageFeedbackRules,
  persistTriagedInbox,
  type PriorThreadTriage,
} from "@/lib/supabase/triage-persistence";
import type { EmailMessage } from "@/types/email";
import type { PriorityLevel, TriageMode, TriagedEmail } from "@/types/triage";

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => value ?? "");

const emailSchema = z.object({
  id: z.string(),
  provider: z
    .enum(["mock", "gmail", "outlook", "yahoo", "microsoft"])
    .transform((provider) => (provider === "microsoft" ? "outlook" : provider)),
  senderName: nullableString.transform((value) => value || "Unknown sender"),
  senderEmail: nullableString.transform((value) => value || "unknown@example.com"),
  subject: nullableString.transform((value) => value || "(No subject)"),
  body: nullableString,
  snippet: nullableString,
  receivedAt: nullableString.transform((value) => value || new Date().toISOString()),
  isRead: z.boolean().catch(false),
  labels: z.array(z.string()).catch([]),
  threadId: nullableString,
});

const triageRequestSchema = z.object({
  mode: z.enum(["job_search", "work", "life_admin"]),
  emails: z.array(emailSchema).max(50),
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
    const localFallback = new LocalTriageService();
    const provider = useOpenAI && process.env.OPENAI_API_KEY ? "openai" : "local";
    const concurrency = provider === "openai" ? getOpenAIConcurrency() : 8;
    const feedbackRules = await getTriageFeedbackRules(admin, user.id, mode);
    const priorThreadTriage = await getPriorThreadTriageMap({
      admin,
      userId: user.id,
      mode,
      emails: emails as EmailMessage[],
    });
    let fallbackCount = 0;
    const items = await mapWithConcurrency(emails, concurrency, async (email) => ({
        email: email as EmailMessage,
        triage: await analyzeWithFallback({
          email: email as EmailMessage,
          mode,
          provider,
          service,
          localFallback,
          onFallback: () => {
            fallbackCount += 1;
          },
        }),
      })).then((triaged) =>
        triaged
          .map((item) => stabilizeThreadTriage(item, priorThreadTriage.get(item.email.id)))
          .map((item) => applyTriageFeedbackRules(item, mode, feedbackRules)),
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

    return NextResponse.json(
      {
        provider,
        items: persisted.items,
        summary: summarizeInbox(persisted.items),
        taskEmailIds: persisted.taskEmailIds,
        taskStates: persisted.taskStates,
        fallbackCount,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
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

function stabilizeThreadTriage(
  item: TriagedEmail,
  prior: PriorThreadTriage | undefined,
) {
  if (!prior || prior.category === "Inbox Noise") return item;

  const current = item.triage;
  const shouldRestoreCategory =
    current.category === "Inbox Noise" ||
    (!current.requiresAction && prior.requiresAction);
  const deadline = current.deadline ?? prior.deadline;
  const priority = highestPriority(current.priority, prior.priority);

  if (!shouldRestoreCategory && priority === current.priority && deadline === current.deadline) {
    return item;
  }

  return {
    ...item,
    triage: {
      ...current,
      category: shouldRestoreCategory ? prior.category : current.category,
      priority,
      requiresAction: current.requiresAction || (shouldRestoreCategory && prior.requiresAction),
      deadline,
      suggestedNextAction:
        current.suggestedNextAction === "No action needed."
          ? "Review the latest thread reply and respond if needed."
          : current.suggestedNextAction,
      actionSummary:
        current.actionSummary.includes("no immediate")
          ? `Continue the existing ${prior.category.toLowerCase()} thread.`
          : current.actionSummary,
      reason: `${current.reason} Prior thread category preserved.`,
    },
  };
}

function highestPriority(a: PriorityLevel, b: PriorityLevel): PriorityLevel {
  const rank: Record<PriorityLevel, number> = { low: 0, medium: 1, high: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function getOpenAIConcurrency() {
  const parsed = Number(process.env.OPENAI_TRIAGE_CONCURRENCY ?? 3);

  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(3, Math.floor(parsed)));
}

async function analyzeWithFallback({
  email,
  mode,
  provider,
  service,
  localFallback,
  onFallback,
}: {
  email: EmailMessage;
  mode: TriageMode;
  provider: "openai" | "local";
  service: TriageService;
  localFallback: LocalTriageService;
  onFallback: () => void;
}) {
  try {
    return await service.analyzeEmail(email, mode);
  } catch (error) {
    if (provider !== "openai") {
      throw error;
    }

    onFallback();
    return localFallback.analyzeEmail(email, mode);
  }
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

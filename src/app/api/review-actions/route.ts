import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordReviewAction } from "@/lib/supabase/triage-persistence";

const reviewActionSchema = z.object({
  emailId: z.string().min(1),
  actionType: z.enum([
    "reviewed",
    "unreviewed",
    "pinned",
    "unpinned",
    "snoozed",
    "unsnoozed",
    "hidden",
    "task_created",
  ]),
  snoozedUntil: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in before saving review actions." },
      { status: 401 },
    );
  }

  const payload = reviewActionSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid review action.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await recordReviewAction({
      admin: createSupabaseAdminClient(),
      userId: user.id,
      emailId: payload.data.emailId,
      actionType: payload.data.actionType,
      snoozedUntil: payload.data.snoozedUntil ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save action." },
      { status: 500 },
    );
  }
}

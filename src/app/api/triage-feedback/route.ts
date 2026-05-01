import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTriageFeedbackRule } from "@/lib/supabase/triage-persistence";

const feedbackSchema = z
  .object({
    emailId: z.string().min(1),
    mode: z.enum(["job_search", "work", "life_admin"]),
    categoryOverride: z.string().min(1).nullable().optional(),
    priorityOverride: z.enum(["high", "medium", "low"]).nullable().optional(),
  })
  .refine(
    (value) => value.categoryOverride !== undefined || value.priorityOverride !== undefined,
    "Provide a category or priority override.",
  );

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving feedback." }, { status: 401 });
  }

  const payload = feedbackSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid feedback request.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await createTriageFeedbackRule({
      admin: createSupabaseAdminClient(),
      userId: user.id,
      emailId: payload.data.emailId,
      mode: payload.data.mode,
      categoryOverride: payload.data.categoryOverride,
      priorityOverride: payload.data.priorityOverride,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save triage feedback.",
      },
      { status: 500 },
    );
  }
}

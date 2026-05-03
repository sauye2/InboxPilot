import { NextResponse } from "next/server";
import { z } from "zod";
import { OpenAIReplyService } from "@/lib/ai/reply-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findPersistedEmailMessage } from "@/lib/supabase/triage-persistence";

const replyRequestSchema = z.object({
  emailId: z.string().min(1),
  tone: z.enum(["concise", "professional", "warm", "friendly", "firm"]).default("professional"),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in before generating reply suggestions." },
      { status: 401 },
    );
  }

  const payload = replyRequestSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid reply suggestion request.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: preferences, error: preferenceError } = await admin
    .from("user_preferences")
    .select("ai_processing_enabled, openai_reply_suggestions_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (preferenceError) {
    return NextResponse.json({ error: preferenceError.message }, { status: 500 });
  }

  if (
    !preferences?.ai_processing_enabled ||
    !preferences?.openai_reply_suggestions_enabled
  ) {
    return NextResponse.json(
      { error: "Turn on OpenAI reply suggestions in Settings first." },
      { status: 403 },
    );
  }

  const persisted = await findPersistedEmailMessage(
    admin,
    user.id,
    payload.data.emailId,
  );

  if (!persisted) {
    return NextResponse.json(
      { error: "Run Scan before generating a reply for this email." },
      { status: 404 },
    );
  }

  try {
    const suggestion = await new OpenAIReplyService().suggestReply(
      persisted.email,
      payload.data.tone,
    );

    return NextResponse.json({ suggestion });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate reply suggestion.",
      },
      { status: 500 },
    );
  }
}

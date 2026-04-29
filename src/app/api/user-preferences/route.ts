import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const preferenceSchema = z.object({
  aiProcessingEnabled: z.boolean().optional(),
  openAITriageEnabled: z.boolean().optional(),
  openAIReplySuggestionsEnabled: z.boolean().optional(),
  retainEmailBodies: z.boolean().optional(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading preferences." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_preferences")
    .select(
      "default_mode, ai_processing_enabled, retain_email_bodies, openai_triage_enabled, openai_reply_suggestions_enabled",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    preferences: toClientPreferences(data),
  });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving preferences." }, { status: 401 });
  }

  const payload = preferenceSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid preferences.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const row = {
    user_id: user.id,
    ...(payload.data.aiProcessingEnabled === undefined
      ? {}
      : { ai_processing_enabled: payload.data.aiProcessingEnabled }),
    ...(payload.data.openAITriageEnabled === undefined
      ? {}
      : { openai_triage_enabled: payload.data.openAITriageEnabled }),
    ...(payload.data.openAIReplySuggestionsEnabled === undefined
      ? {}
      : {
          openai_reply_suggestions_enabled:
            payload.data.openAIReplySuggestionsEnabled,
        }),
    ...(payload.data.retainEmailBodies === undefined
      ? {}
      : { retain_email_bodies: payload.data.retainEmailBodies }),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("user_preferences")
    .upsert(row, { onConflict: "user_id" })
    .select(
      "default_mode, ai_processing_enabled, retain_email_bodies, openai_triage_enabled, openai_reply_suggestions_enabled",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    preferences: toClientPreferences(data),
  });
}

function toClientPreferences(
  data: Record<string, unknown> | null,
) {
  return {
    defaultMode: (data?.default_mode as string | undefined) ?? "job_search",
    aiProcessingEnabled: Boolean(data?.ai_processing_enabled),
    retainEmailBodies: Boolean(data?.retain_email_bodies),
    openAITriageEnabled: Boolean(data?.openai_triage_enabled),
    openAIReplySuggestionsEnabled: Boolean(
      data?.openai_reply_suggestions_enabled,
    ),
  };
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getPersistedTasks,
  updateTaskForEmail,
} from "@/lib/supabase/triage-persistence";

const taskPatchSchema = z.object({
  emailId: z.string().min(1),
  status: z.enum(["to_reply", "waiting", "done", "archived"]).optional(),
  draftSubject: z.string().nullable().optional(),
  draftBody: z.string().nullable().optional(),
});

const providerSchema = z.enum(["gmail", "outlook"]).optional();

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading tasks." }, { status: 401 });
  }

  try {
    const provider = providerSchema.parse(
      request.nextUrl.searchParams.get("provider") ?? undefined,
    );
    const tasks = await getPersistedTasks({
      admin: createSupabaseAdminClient(),
      userId: user.id,
      provider,
    });

    return NextResponse.json(tasks, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load tasks.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before creating tasks." }, { status: 401 });
  }

  const payload = taskPatchSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid task request.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await updateTaskForEmail({
      admin: createSupabaseAdminClient(),
      userId: user.id,
      emailId: payload.data.emailId,
      status: payload.data.status ?? "to_reply",
      draftSubject: payload.data.draftSubject,
      draftBody: payload.data.draftBody,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create task.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before updating tasks." }, { status: 401 });
  }

  const payload = taskPatchSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid task request.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await updateTaskForEmail({
      admin: createSupabaseAdminClient(),
      userId: user.id,
      emailId: payload.data.emailId,
      status: payload.data.status,
      draftSubject: payload.data.draftSubject,
      draftBody: payload.data.draftBody,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update task.",
      },
      { status: 500 },
    );
  }
}

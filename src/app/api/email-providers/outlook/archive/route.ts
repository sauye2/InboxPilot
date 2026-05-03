import { NextResponse } from "next/server";
import { z } from "zod";
import {
  archiveOutlookMessage,
  refreshOutlookAccessToken,
} from "@/lib/email-providers/outlook-oauth";
import { decryptSecret } from "@/lib/security/encryption";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  auditProviderEvent,
  findPersistedEmailMessage,
} from "@/lib/supabase/triage-persistence";

const archiveSchema = z.object({
  emailId: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before archiving Outlook messages." }, { status: 401 });
  }

  const payload = archiveSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid Outlook archive request.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const persisted = await findPersistedEmailMessage(admin, user.id, payload.data.emailId);

  if (!persisted || persisted.email.provider !== "outlook") {
    return NextResponse.json(
      { error: "This action can only archive scanned Outlook messages." },
      { status: 400 },
    );
  }

  const { data: token, error } = await admin
    .from("email_connection_tokens")
    .select("connection_id, encrypted_refresh_token, encryption_iv, encryption_tag")
    .eq("user_id", user.id)
    .eq("provider", "outlook")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ error: "Reconnect Outlook before archiving messages." }, { status: 409 });
  }

  try {
    const refreshToken = decryptSecret({
      ciphertext: token.encrypted_refresh_token,
      iv: token.encryption_iv,
      tag: token.encryption_tag,
    });
    const refreshed = await refreshOutlookAccessToken(refreshToken);
    const outlookMessageId = persisted.email.id.replace(/^outlook:/, "");
    const archived = await archiveOutlookMessage({
      accessToken: refreshed.access_token,
      outlookMessageId,
    });

    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "outlook",
      eventType: "archive_success",
      message: archived.id,
    });

    return NextResponse.json({
      ok: true,
      messageId: archived.id,
      threadId: archived.conversationId,
    });
  } catch (error) {
    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "outlook",
      eventType: "archive_failed",
      message: error instanceof Error ? error.message : "Unknown Outlook archive error.",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to archive Outlook message.",
      },
      { status: 500 },
    );
  }
}

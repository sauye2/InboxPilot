import { NextResponse } from "next/server";
import { z } from "zod";
import {
  refreshOutlookAccessToken,
  sendOutlookThreadReply,
} from "@/lib/email-providers/outlook-oauth";
import { decryptSecret } from "@/lib/security/encryption";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  auditProviderEvent,
  findPersistedEmailMessage,
  updateTaskForEmail,
} from "@/lib/supabase/triage-persistence";

const sendReplySchema = z.object({
  emailId: z.string().min(1),
  body: z.string().min(1).max(12000),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before sending Outlook replies." }, { status: 401 });
  }

  const payload = sendReplySchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid Outlook reply request.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const persisted = await findPersistedEmailMessage(admin, user.id, payload.data.emailId);

  if (!persisted || persisted.email.provider !== "outlook") {
    return NextResponse.json(
      { error: "This action can only send replies to scanned Outlook messages." },
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
    return NextResponse.json({ error: "Reconnect Outlook before sending replies." }, { status: 409 });
  }

  try {
    const refreshToken = decryptSecret({
      ciphertext: token.encrypted_refresh_token,
      iv: token.encryption_iv,
      tag: token.encryption_tag,
    });
    const refreshed = await refreshOutlookAccessToken(refreshToken);
    const { data: connection } = await admin
      .from("email_connections")
      .select("provider_account_email")
      .eq("id", token.connection_id)
      .maybeSingle();
    const outlookMessageId = persisted.email.id.replace(/^outlook:/, "");
    const sent = await sendOutlookThreadReply({
      accessToken: refreshed.access_token,
      outlookMessageId,
      body: payload.data.body,
      replyToEmail: (connection?.provider_account_email as string | null | undefined) ?? null,
    });
    const now = new Date().toISOString();

    await updateTaskForEmail({
      admin,
      userId: user.id,
      emailId: payload.data.emailId,
      status: "waiting",
      draftBody: payload.data.body,
      lastOutboundAt: now,
    });
    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "outlook",
      eventType: "send_success",
      message: sent.id,
    });

    return NextResponse.json({ ok: true, messageId: sent.id });
  } catch (error) {
    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "outlook",
      eventType: "send_failed",
      message: error instanceof Error ? error.message : "Unknown Outlook send error.",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send Outlook reply.",
      },
      { status: 500 },
    );
  }
}

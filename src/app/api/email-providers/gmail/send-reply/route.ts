import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchGmailReplyTarget,
  refreshGmailAccessToken,
  sendGmailThreadReply,
} from "@/lib/email-providers/gmail-oauth";
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
    return NextResponse.json({ error: "Sign in before sending Gmail replies." }, { status: 401 });
  }

  const payload = sendReplySchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid Gmail reply request.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const persisted = await findPersistedEmailMessage(admin, user.id, payload.data.emailId);

  if (!persisted || persisted.email.provider !== "gmail") {
    return NextResponse.json(
      { error: "This action can only send replies to scanned Gmail messages." },
      { status: 400 },
    );
  }

  const { data: token, error } = await admin
    .from("email_connection_tokens")
    .select("connection_id, encrypted_refresh_token, encryption_iv, encryption_tag")
    .eq("user_id", user.id)
    .eq("provider", "gmail")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ error: "Reconnect Gmail before sending replies." }, { status: 409 });
  }

  try {
    const refreshToken = decryptSecret({
      ciphertext: token.encrypted_refresh_token,
      iv: token.encryption_iv,
      tag: token.encryption_tag,
    });
    const refreshed = await refreshGmailAccessToken(refreshToken);
    const gmailMessageId = persisted.email.id.replace(/^gmail:/, "");
    const target = await fetchGmailReplyTarget(refreshed.access_token, gmailMessageId);
    const sent = await sendGmailThreadReply({
      accessToken: refreshed.access_token,
      target,
      body: payload.data.body,
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
      provider: "gmail",
      eventType: "send_success",
      message: sent.id,
    });

    return NextResponse.json({ ok: true, messageId: sent.id, threadId: sent.threadId });
  } catch (error) {
    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "gmail",
      eventType: "send_failed",
      message: error instanceof Error ? error.message : "Unknown Gmail send error.",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send Gmail reply.",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  refreshGmailAccessToken,
  trashGmailMessage,
} from "@/lib/email-providers/gmail-oauth";
import { decryptSecret } from "@/lib/security/encryption";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  auditProviderEvent,
  findPersistedEmailMessage,
} from "@/lib/supabase/triage-persistence";

const trashSchema = z.object({
  emailId: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before deleting Gmail messages." }, { status: 401 });
  }

  const payload = trashSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid Gmail delete request.", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const persisted = await findPersistedEmailMessage(admin, user.id, payload.data.emailId);

  if (!persisted || persisted.email.provider !== "gmail") {
    return NextResponse.json(
      { error: "This action can only delete scanned Gmail messages." },
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
    return NextResponse.json({ error: "Reconnect Gmail before deleting messages." }, { status: 409 });
  }

  try {
    const refreshToken = decryptSecret({
      ciphertext: token.encrypted_refresh_token,
      iv: token.encryption_iv,
      tag: token.encryption_tag,
    });
    const refreshed = await refreshGmailAccessToken(refreshToken);
    const gmailMessageId = persisted.email.id.replace(/^gmail:/, "");
    const trashed = await trashGmailMessage({
      accessToken: refreshed.access_token,
      gmailMessageId,
    });

    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "gmail",
      eventType: "trash_success",
      message: trashed.id,
    });

    return NextResponse.json({ ok: true, messageId: trashed.id, threadId: trashed.threadId });
  } catch (error) {
    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "gmail",
      eventType: "trash_failed",
      message: error instanceof Error ? error.message : "Unknown Gmail trash error.",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete Gmail message.",
      },
      { status: 500 },
    );
  }
}

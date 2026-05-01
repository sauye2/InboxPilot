import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchRecentGmailMessages,
  isGmailAuthError,
  refreshGmailAccessToken,
} from "@/lib/email-providers/gmail-oauth";
import { decryptSecret } from "@/lib/security/encryption";
import { auditProviderEvent } from "@/lib/supabase/triage-persistence";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before fetching Gmail." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
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
    return NextResponse.json(
      { error: "Reconnect Gmail so InboxPilot can store an encrypted refresh token." },
      { status: 409 },
    );
  }

  try {
    const refreshToken = decryptSecret({
      ciphertext: token.encrypted_refresh_token,
      iv: token.encryption_iv,
      tag: token.encryption_tag,
    });
    const refreshed = await refreshGmailAccessToken(refreshToken);
    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "gmail",
      eventType: "refresh_success",
      message: "Gmail access token refreshed for message fetch.",
    });
    const messages = await fetchRecentGmailMessages(refreshed.access_token);
    await admin
      .from("email_connections")
      .update({
        status: "connected",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", token.connection_id);

    return NextResponse.json({ messages });
  } catch (fetchError) {
    const shouldExpireConnection = isGmailAuthError(fetchError);

    if (shouldExpireConnection) {
      await admin
        .from("email_connections")
        .update({ status: "expired" })
        .eq("id", token.connection_id);
    }

    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "gmail",
      eventType: shouldExpireConnection ? "refresh_failed" : "fetch_failed",
      message:
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to fetch Gmail messages.",
    });

    return NextResponse.json(
      {
        error: shouldExpireConnection
          ? "Reconnect Gmail so InboxPilot can refresh the required permissions."
          : fetchError instanceof Error
            ? fetchError.message
            : "Unable to fetch Gmail messages.",
      },
      { status: shouldExpireConnection ? 409 : 500 },
    );
  }
}

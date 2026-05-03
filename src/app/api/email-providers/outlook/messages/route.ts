import { NextResponse } from "next/server";
import {
  fetchRecentOutlookMessages,
  isOutlookAuthError,
  refreshOutlookAccessToken,
} from "@/lib/email-providers/outlook-oauth";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { auditProviderEvent } from "@/lib/supabase/triage-persistence";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before fetching Outlook." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
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
    return NextResponse.json(
      { error: "Reconnect Outlook so InboxPilot can store an encrypted refresh token." },
      { status: 409 },
    );
  }

  try {
    const refreshToken = decryptSecret({
      ciphertext: token.encrypted_refresh_token,
      iv: token.encryption_iv,
      tag: token.encryption_tag,
    });
    const refreshed = await refreshOutlookAccessToken(refreshToken);

    if (refreshed.refresh_token) {
      const encrypted = encryptSecret(refreshed.refresh_token);
      await admin
        .from("email_connection_tokens")
        .update({
          encrypted_refresh_token: encrypted.ciphertext,
          encryption_iv: encrypted.iv,
          encryption_tag: encrypted.tag,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          scopes: refreshed.scope?.split(" ").filter(Boolean) ?? undefined,
        })
        .eq("connection_id", token.connection_id);
    }

    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: token.connection_id,
      provider: "outlook",
      eventType: "refresh_success",
      message: "Outlook access token refreshed for message fetch.",
    });
    const messages = await fetchRecentOutlookMessages(refreshed.access_token);
    await admin
      .from("email_connections")
      .update({
        status: "connected",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", token.connection_id);

    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (fetchError) {
    const shouldExpireConnection = isOutlookAuthError(fetchError);

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
      provider: "outlook",
      eventType: shouldExpireConnection ? "refresh_failed" : "fetch_failed",
      message:
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to fetch Outlook messages.",
    });

    return NextResponse.json(
      {
        error: shouldExpireConnection
          ? "Reconnect Outlook so InboxPilot can refresh the required permissions."
          : fetchError instanceof Error
            ? fetchError.message
            : "Unable to fetch Outlook messages.",
      },
      { status: shouldExpireConnection ? 409 : 500 },
    );
  }
}

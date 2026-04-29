import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchRecentGmailMessages,
  refreshGmailAccessToken,
} from "@/lib/email-providers/gmail-oauth";
import { decryptSecret } from "@/lib/security/encryption";

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
    .select("encrypted_refresh_token, encryption_iv, encryption_tag")
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

  const refreshToken = decryptSecret({
    ciphertext: token.encrypted_refresh_token,
    iv: token.encryption_iv,
    tag: token.encryption_tag,
  });
  const refreshed = await refreshGmailAccessToken(refreshToken);
  const messages = await fetchRecentGmailMessages(refreshed.access_token);

  return NextResponse.json({ messages });
}

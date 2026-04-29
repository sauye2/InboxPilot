import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  exchangeGmailCode,
  fetchGmailProfile,
  verifyOAuthState,
} from "@/lib/email-providers/gmail-oauth";
import { encryptSecret } from "@/lib/security/encryption";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/connections?message=${encodeURIComponent(error)}`, url.origin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/connections", url.origin));
  }

  if (!code || !state || !verifyOAuthState(state, user.id)) {
    return NextResponse.redirect(
      new URL("/connections?message=Unable%20to%20verify%20Gmail%20connection.", url.origin),
    );
  }

  try {
    const tokenSet = await exchangeGmailCode(code);
    const profile = await fetchGmailProfile(tokenSet.access_token);
    const admin = createSupabaseAdminClient();

    const { data: connection, error: connectionError } = await supabase.from("email_connections").upsert(
      {
        user_id: user.id,
        provider: "gmail",
        provider_account_email: profile.emailAddress,
        status: "connected",
        scopes: tokenSet.scope.split(" "),
        token_vault_key: tokenSet.refresh_token
          ? "pending_encrypted_token_storage"
          : "access_token_only_not_persisted",
        last_sync_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider,provider_account_email",
        ignoreDuplicates: false,
      },
    ).select("id").single();

    if (connectionError || !connection) {
      throw connectionError ?? new Error("Unable to save Gmail connection.");
    }

    if (tokenSet.refresh_token) {
      const encrypted = encryptSecret(tokenSet.refresh_token);
      await admin.from("email_connection_tokens").upsert(
        {
          user_id: user.id,
          connection_id: connection.id,
          provider: "gmail",
          encrypted_refresh_token: encrypted.ciphertext,
          encryption_iv: encrypted.iv,
          encryption_tag: encrypted.tag,
          token_expires_at: new Date(Date.now() + tokenSet.expires_in * 1000).toISOString(),
          scopes: tokenSet.scope.split(" "),
        },
        {
          onConflict: "connection_id",
        },
      );
    }

    return NextResponse.redirect(
      new URL(
        `/connections?message=${encodeURIComponent(`Gmail connected: ${profile.emailAddress}`)}`,
        url.origin,
      ),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/connections?message=Gmail%20connection%20failed.", url.origin),
    );
  }
}

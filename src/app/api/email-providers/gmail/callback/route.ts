import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  exchangeGmailCode,
  fetchGmailProfile,
  verifyOAuthState,
} from "@/lib/email-providers/gmail-oauth";

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

    await supabase.from("email_connections").upsert(
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
      },
    );

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

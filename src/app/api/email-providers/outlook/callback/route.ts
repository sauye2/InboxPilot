import { NextResponse } from "next/server";
import {
  exchangeOutlookCode,
  fetchOutlookProfile,
  OUTLOOK_SCOPES,
  verifyOutlookOAuthState,
} from "@/lib/email-providers/outlook-oauth";
import { encryptSecret } from "@/lib/security/encryption";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  if (!code || !state || !verifyOutlookOAuthState(state, user.id)) {
    return NextResponse.redirect(
      new URL(
        "/connections?message=Unable%20to%20verify%20Outlook%20connection.",
        url.origin,
      ),
    );
  }

  try {
    const tokenSet = await exchangeOutlookCode(code);
    const grantedScopes = tokenSet.scope.split(" ").filter(Boolean);
    const requiredScopes = OUTLOOK_SCOPES.split(" ").filter(
      (scope) => scope !== "offline_access",
    );
    const missingScope = requiredScopes.find(
      (scope) => !grantedScopes.some((granted) => granted.toLowerCase() === scope.toLowerCase()),
    );

    if (missingScope) {
      return NextResponse.redirect(
        new URL(
          "/connections?message=Outlook%20connection%20needs%20the%20requested%20mailbox%20permissions.",
          url.origin,
        ),
      );
    }

    const profile = await fetchOutlookProfile(tokenSet.access_token);
    const accountEmail = profile.mail ?? profile.userPrincipalName ?? "";
    const admin = createSupabaseAdminClient();

    const { data: connection, error: connectionError } = await supabase
      .from("email_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "outlook",
          provider_account_email: accountEmail,
          status: "connected",
          scopes: grantedScopes,
          token_vault_key: tokenSet.refresh_token
            ? "pending_encrypted_token_storage"
            : "access_token_only_not_persisted",
          last_sync_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider,provider_account_email",
          ignoreDuplicates: false,
        },
      )
      .select("id")
      .single();

    if (connectionError || !connection) {
      throw connectionError ?? new Error("Unable to save Outlook connection.");
    }

    if (tokenSet.refresh_token) {
      const encrypted = encryptSecret(tokenSet.refresh_token);
      await admin.from("email_connection_tokens").upsert(
        {
          user_id: user.id,
          connection_id: connection.id,
          provider: "outlook",
          encrypted_refresh_token: encrypted.ciphertext,
          encryption_iv: encrypted.iv,
          encryption_tag: encrypted.tag,
          token_expires_at: new Date(Date.now() + tokenSet.expires_in * 1000).toISOString(),
          scopes: grantedScopes,
        },
        {
          onConflict: "connection_id",
        },
      );
    }

    return NextResponse.redirect(
      new URL(
        `/connections?message=${encodeURIComponent(`Outlook connected: ${accountEmail}`)}`,
        url.origin,
      ),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/connections?message=Outlook%20connection%20failed.", url.origin),
    );
  }
}

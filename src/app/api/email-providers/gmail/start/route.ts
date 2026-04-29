import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildGmailAuthorizationUrl } from "@/lib/email-providers/gmail-oauth";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/connections", request.url));
  }

  try {
    return NextResponse.redirect(buildGmailAuthorizationUrl(user.id));
  } catch {
    return NextResponse.redirect(
      new URL("/connections?message=Google%20OAuth%20is%20not%20configured.", request.url),
    );
  }
}

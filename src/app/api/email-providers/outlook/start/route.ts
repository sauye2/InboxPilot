import { NextResponse } from "next/server";
import { buildOutlookAuthorizationUrl } from "@/lib/email-providers/outlook-oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/connections", request.url));
  }

  try {
    return NextResponse.redirect(buildOutlookAuthorizationUrl(user.id));
  } catch {
    return NextResponse.redirect(
      new URL(
        "/connections?message=Microsoft%20OAuth%20is%20not%20configured.",
        request.url,
      ),
    );
  }
}

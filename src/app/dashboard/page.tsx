import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data: gmailConnection } = await supabase
    .from("email_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "gmail")
    .eq("status", "connected")
    .maybeSingle();

  return (
    <AppShell>
      <DashboardClient hasGmailConnection={Boolean(gmailConnection)} />
    </AppShell>
  );
}

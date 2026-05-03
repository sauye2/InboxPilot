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
  const { data: outlookConnection } = await supabase
    .from("email_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "outlook")
    .eq("status", "connected")
    .maybeSingle();
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("ai_processing_enabled, openai_triage_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AppShell>
      <DashboardClient
        hasGmailConnection={Boolean(gmailConnection)}
        hasOutlookConnection={Boolean(outlookConnection)}
        initialAIProcessingEnabled={Boolean(preferences?.ai_processing_enabled)}
        initialOpenAITriageEnabled={Boolean(preferences?.openai_triage_enabled)}
      />
    </AppShell>
  );
}

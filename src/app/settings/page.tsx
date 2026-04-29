import { Brain, Database, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AIPreferenceCard } from "@/components/settings/ai-preference-card";

const settings = [
  {
    title: "AI provider",
    body: "OpenAI is available for opted-in scans and reply suggestions can plug into the same service layer later.",
    icon: Brain,
  },
  {
    title: "Supabase account",
    body: "Supabase handles sign-in now. Saved triage results and review history can be added next.",
    icon: Database,
  },
  {
    title: "Privacy controls",
    body: "Production versions should minimize email body retention and process inbox data only after explicit account connection.",
    icon: ShieldCheck,
  },
];

export default function SettingsPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:py-12">
        <section className="liquid-glass-dark grid gap-8 rounded-2xl p-6 text-[#f7f6f1] sm:p-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-[#8bd3c7]">
              Future configuration
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
              Settings for the secure version.
            </h1>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-white/64">
            Manage privacy-conscious scanning choices and the production services
            that support InboxPilot.
          </p>
        </section>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <AIPreferenceCard />
          {settings.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="liquid-glass rounded-2xl border-black/10 bg-white/66 p-6"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-[#e7f1ec] text-[#0e6f68]">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-6 text-xl font-semibold text-[#141817]">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#4a504d]">
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | InboxPilot",
  description: "InboxPilot privacy policy for email triage, Gmail access, AI processing, and user data handling.",
};

const sections = [
  {
    title: "What InboxPilot does",
    body: "InboxPilot helps users triage email by scanning connected messages, categorizing them, ranking priority, creating task items, and optionally generating reply suggestions.",
  },
  {
    title: "Information we collect",
    body: "When you use InboxPilot, we may collect account profile information, your email address, connected provider metadata, encrypted provider tokens, scan settings, triage results, review actions, task items, feedback, and draft reply text that you choose to save or send.",
  },
  {
    title: "Gmail data access",
    body: "InboxPilot only accesses Gmail data after you explicitly sign in and connect Gmail. Gmail access is used to read recent messages for triage, send replies only after you approve them, and move messages to trash only after you confirm the delete action.",
  },
  {
    title: "How we use Gmail data",
    body: "Gmail message data is used to provide user-facing email triage, priority ranking, category labels, task workflows, reply drafting, sending approved replies, and confirmed deletion actions. InboxPilot does not use Gmail data for advertising or unrelated product analytics.",
  },
  {
    title: "AI processing",
    body: "If you opt in, InboxPilot may send selected message metadata, snippets, and available body text to OpenAI to improve classification, next-step summaries, and reply suggestions. If you opt out, InboxPilot scans with local rules only. You can change this preference in Settings.",
  },
  {
    title: "Storage and retention",
    body: "InboxPilot may store encrypted provider connection tokens, triage results, task records, review state, feedback, and editable draft replies so your workflow can persist across sessions. We aim to minimize email body retention and keep sensitive provider credentials encrypted server-side.",
  },
  {
    title: "Sharing and sale of data",
    body: "InboxPilot does not sell your personal information or email data. We do not share Gmail data with advertisers. Data may be processed by infrastructure providers, Supabase, OpenAI if you opt in to AI processing, and Google APIs only as needed to operate the product.",
  },
  {
    title: "Google API Limited Use",
    body: "InboxPilot's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
  },
  {
    title: "Security",
    body: "Provider tokens are intended to be encrypted at rest and used only from server-side routes. Production versions should maintain secure token storage, least-privilege access, audit logs for provider actions, and controls that let users revoke connected accounts.",
  },
  {
    title: "Your controls",
    body: "You can disconnect Gmail from the Connections page, opt in or out of OpenAI-assisted processing from Settings, review or remove tasks, and choose whether to send or delete messages. InboxPilot does not send replies or delete emails without your confirmation.",
  },
  {
    title: "Children's privacy",
    body: "InboxPilot is not intended for children under 13. We do not knowingly collect personal information from children under 13.",
  },
  {
    title: "Changes to this policy",
    body: "We may update this policy as InboxPilot changes. When material changes are made, the effective date on this page will be updated.",
  },
];

export default function PrivacyPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 lg:py-14">
        <section className="liquid-glass-dark rounded-2xl p-8 text-[#f7f6f1] sm:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#8bd3c7]/20 bg-[#8bd3c7]/12 px-3 py-1.5 text-xs font-medium text-[#8bd3c7]">
            <ShieldCheck className="size-3.5" />
            Effective May 1, 2026
          </div>
          <h1 className="mt-5 text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
            Privacy Policy
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/68">
            InboxPilot is built for sensitive inbox data. This policy explains
            what the app accesses, how it uses AI, and how connected mailbox
            data should be handled.
          </p>
        </section>

        <section className="mt-6 grid gap-4">
          {sections.map((section) => (
            <article
              key={section.title}
              className="liquid-glass rounded-2xl border-black/10 bg-white/64 p-6"
            >
              <h2 className="text-xl font-semibold text-[#141817]">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#4a504d]">
                {section.body}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-black/10 bg-[#fffdf7]/72 p-6 text-sm leading-7 text-[#4a504d]">
          <p>
            Questions, access requests, or deletion requests should be directed
            to the support email listed on the Google OAuth consent screen for
            InboxPilot.
          </p>
          <Link href="/terms" className="mt-3 inline-flex font-semibold text-[#0e6f68]">
            View Terms of Service
          </Link>
        </section>
      </main>
    </AppShell>
  );
}

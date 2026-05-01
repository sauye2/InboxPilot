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
    title: "Email access",
    body: "InboxPilot only accesses mailbox data after a user explicitly signs in and connects an email account. Gmail access is used to read recent messages for triage, send user-approved replies, and move messages to trash when the user confirms a delete action.",
  },
  {
    title: "AI processing",
    body: "If a user opts in, InboxPilot may send selected message metadata, snippets, and available body text to OpenAI to improve classification, next-step summaries, and reply suggestions. If a user opts out, InboxPilot uses local rules instead.",
  },
  {
    title: "Data storage",
    body: "InboxPilot may store account profile information, encrypted provider connection tokens, triage results, user feedback, review actions, task items, and editable draft replies. Production versions should minimize full email body retention and keep tokens encrypted and revocable.",
  },
  {
    title: "What InboxPilot does not do",
    body: "InboxPilot does not sell email data, does not send emails without explicit user approval, and does not access inboxes unless the user connects an account.",
  },
  {
    title: "Disconnecting and deletion",
    body: "Users can disconnect Gmail from the Connections page. Disconnecting revokes the stored provider connection and prevents future scans until the user reconnects.",
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
            Questions about this policy should be directed to the support email
            listed on the Google OAuth consent screen for InboxPilot.
          </p>
          <Link href="/terms" className="mt-3 inline-flex font-semibold text-[#0e6f68]">
            View Terms of Service
          </Link>
        </section>
      </main>
    </AppShell>
  );
}

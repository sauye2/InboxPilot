import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Terms of Service | InboxPilot",
  description: "InboxPilot terms of service for email triage, AI suggestions, Gmail actions, and beta use.",
};

const terms = [
  {
    title: "Use of InboxPilot",
    body: "InboxPilot is an email triage application that helps users organize and act on mailbox messages. You are responsible for the email accounts you connect and the actions you approve.",
  },
  {
    title: "AI suggestions",
    body: "AI-generated classifications, summaries, and reply drafts are suggestions only. Review all outputs before relying on them or sending any reply.",
  },
  {
    title: "Gmail actions",
    body: "InboxPilot may read recent Gmail messages, send replies, and move messages to trash only after the user grants access and confirms the action in the app.",
  },
  {
    title: "User content",
    body: "You retain responsibility for email content, task notes, draft replies, and feedback you save in InboxPilot. Do not use the service for unlawful, harmful, or abusive activity.",
  },
  {
    title: "Beta software",
    body: "InboxPilot is an early product and may change over time. Features may be incomplete, unavailable, or modified as the product is improved.",
  },
  {
    title: "No warranty",
    body: "InboxPilot is provided as is, without warranties of any kind. The app does not guarantee that every important email will be detected or prioritized correctly.",
  },
];

export default function TermsPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 lg:py-14">
        <section className="liquid-glass-dark rounded-2xl p-8 text-[#f7f6f1] sm:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#8bd3c7]/20 bg-[#8bd3c7]/12 px-3 py-1.5 text-xs font-medium text-[#8bd3c7]">
            <FileText className="size-3.5" />
            Effective May 1, 2026
          </div>
          <h1 className="mt-5 text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
            Terms of Service
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/68">
            These terms describe the expected use of InboxPilot, including
            AI-assisted triage, connected Gmail actions, and beta limitations.
          </p>
        </section>

        <section className="mt-6 grid gap-4">
          {terms.map((term) => (
            <article
              key={term.title}
              className="liquid-glass rounded-2xl border-black/10 bg-white/64 p-6"
            >
              <h2 className="text-xl font-semibold text-[#141817]">
                {term.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#4a504d]">
                {term.body}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-black/10 bg-[#fffdf7]/72 p-6 text-sm leading-7 text-[#4a504d]">
          <p>
            Questions about these terms should be directed to the support email
            listed on the Google OAuth consent screen for InboxPilot.
          </p>
          <Link href="/privacy" className="mt-3 inline-flex font-semibold text-[#0e6f68]">
            View Privacy Policy
          </Link>
        </section>
      </main>
    </AppShell>
  );
}

import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

const providers = [
  {
    name: "Gmail",
    detail: "Planned Gmail API OAuth adapter. Not enabled in this local MVP.",
    status: "Coming soon",
  },
  {
    name: "Outlook / Microsoft 365",
    detail: "Planned Microsoft Graph adapter. Not enabled in this local MVP.",
    status: "Coming soon",
  },
  {
    name: "Yahoo Mail",
    detail: "Planned provider-specific or IMAP adapter after security review.",
    status: "Coming soon",
  },
];

export default function ConnectionsPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:py-12">
        <section className="liquid-glass-dark grid gap-8 rounded-2xl p-6 text-[#f7f6f1] sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:p-14">
          <div>
            <Badge className="rounded-md bg-[#193d38] text-[#8bd3c7] hover:bg-[#193d38]">
              Connection center
            </Badge>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
              Sign in paths are planned, not active.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/64">
              InboxPilot will eventually let users explicitly connect a mailbox.
              This MVP does not connect, import, retain, or store any real email
              data. The dashboard uses mock messages only.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className={buttonVariants({
                  size: "lg",
                  className: "h-12 bg-[#f7f6f1] text-[#111614] hover:bg-white",
                })}
              >
                Continue with mock inbox
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className:
                    "h-12 border-white/16 bg-transparent text-[#f7f6f1] hover:bg-white/8 hover:text-white",
                })}
              >
                Back to overview
              </Link>
            </div>
          </div>

          <div className="liquid-glass-dark rounded-xl p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-[#8bd3c7]/12 text-[#8bd3c7]">
                <LockKeyhole className="size-5" />
              </span>
              <div>
                <p className="font-semibold">Data handling promise</p>
                <p className="text-sm text-white/52">Current localhost build</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 text-sm leading-6 text-white/68">
              <p>No OAuth credentials are requested.</p>
              <p>No real mailbox is fetched.</p>
              <p>No email body is stored by this website.</p>
              <p>Mock data powers the current triage experience.</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {providers.map((provider) => (
            <article
              key={provider.name}
              className="liquid-glass rounded-2xl border-black/10 bg-white/66 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-lg bg-[#e7f1ec]">
                  <Mail className="size-5 text-[#0e6f68]" />
                </span>
                <Badge className="bg-[#ede9df] text-[#4a504d] hover:bg-[#ede9df]">
                  {provider.status}
                </Badge>
              </div>
              <h2 className="mt-5 text-xl font-semibold text-[#141817]">
                {provider.name}
              </h2>
              <p className="mt-3 min-h-16 text-sm leading-6 text-[#4a504d]">
                {provider.detail}
              </p>
              <button
                disabled
                className="mt-5 flex h-11 w-full items-center justify-center rounded-md border border-black/10 bg-[#ede9df]/70 text-sm font-medium text-[#7d8680]"
              >
                Sign in unavailable
              </button>
            </article>
          ))}
        </section>

        <section className="liquid-glass mt-8 rounded-2xl border-[#0e6f68]/20 bg-[#e7f1ec]/74 p-5 text-[#155f59]">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm leading-6">
              Future production versions should encrypt provider tokens,
              minimize email body retention, support account disconnect, and
              make any AI processing opt-in and auditable.
            </p>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

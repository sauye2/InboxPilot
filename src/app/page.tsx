import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  CircleDollarSign,
  Clock3,
  Fingerprint,
  LockKeyhole,
  MailCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { SiteHeader } from "@/components/layout/site-header";

const useCases = [
  {
    index: "01",
    title: "Job search",
    description:
      "Surface interviews, recruiter replies, assessments, offers, and application deadlines before they get buried.",
    icon: BriefcaseBusiness,
    categories: ["Interviews", "Recruiters", "Offers", "Deadlines"],
  },
  {
    index: "02",
    title: "Work inbox",
    description:
      "Separate manager asks, client blockers, approvals, meetings, and document reviews from routine status noise.",
    icon: MailCheck,
    categories: ["Needs reply", "Approvals", "Clients", "Meetings"],
  },
  {
    index: "03",
    title: "Life admin",
    description:
      "Keep bills, appointments, financial alerts, purchases, reservations, and personal replies in one action queue.",
    icon: CalendarCheck,
    categories: ["Bills", "Medical", "Finance", "Shipping"],
  },
];

const privacyPrinciples = [
  "This demo does not connect to real inboxes.",
  "InboxPilot should not store email bodies by default.",
  "Production OAuth tokens must be encrypted and revocable.",
  "AI processing should be explicit, scoped, and auditable.",
];

export default function Home() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f7f6f1] text-[#141817]">
      <SiteHeader />

      <section className="landing-section section-fade relative min-h-dvh px-5 pb-16 pt-20 sm:px-8 lg:pt-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="float-slow absolute left-[4%] top-28 h-[44rem] w-[44rem] rounded-full border border-[#0e6f68]/20" />
          <div className="float-slower absolute right-[-16rem] top-32 h-[28rem] w-[28rem] rounded-full border border-[#a85d35]/16" />
          <div className="absolute bottom-12 left-1/2 h-px w-[78vw] -translate-x-1/2 bg-black/10" />
        </div>

        <div className="relative mx-auto grid min-h-[calc(100dvh-5rem)] max-w-[1500px] gap-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
          <ScrollReveal className="max-w-5xl lg:-mt-20" direction="left">
            <Badge className="rounded-md bg-[#e7f1ec] px-3 py-1 text-[#155f59] hover:bg-[#e7f1ec]">
              Local preview. No real email data stored.
            </Badge>
            <h1 className="mt-8 max-w-5xl text-[clamp(4rem,12vw,11rem)] font-semibold leading-[0.86] tracking-normal">
              Your inbox, ranked by consequence.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#4a504d]">
              InboxPilot is an AI-ready triage layer for confidential email. It
              identifies what needs attention, explains why, and keeps the first
              version safely local with mock data only.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className={buttonVariants({
                  size: "lg",
                  className:
                    "h-12 bg-[#141817] px-5 text-[#f7f6f1] hover:bg-[#27302d]",
                })}
              >
                Explore local demo
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal
            className="relative min-h-[520px]"
            direction="right"
            delay={140}
          >
            <div className="absolute inset-x-6 top-2 h-full rounded-[2rem] border border-black/10 bg-[#161b1a] shadow-2xl shadow-black/20" />
            <div className="relative z-10 mx-auto flex min-h-[520px] w-full max-w-[440px] flex-col justify-center gap-4 px-4 py-10">
              <div className="liquid-glass-dark rounded-xl p-5 text-[#f7f6f1]">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs uppercase text-white/45">
                      Priority queue
                    </p>
                    <p className="mt-1 text-xl font-semibold">Next actions</p>
                  </div>
                  <Sparkles className="size-5 text-[#8bd3c7]" />
                </div>
                {[
                  ["High", "Confirm technical interview", "Tomorrow 5 PM"],
                  ["High", "Approve client launch brief", "Today noon"],
                  ["Medium", "Review utility bill", "May 3"],
                ].map(([priority, title, deadline]) => (
                  <div
                    key={title}
                    className="grid gap-2 border-b border-white/10 py-4 last:border-0"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium sm:text-base">{title}</p>
                      <span className="rounded bg-[#f0a46b]/16 px-2 py-1 text-xs text-[#ffc59e]">
                        {priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/55">
                      <Clock3 className="size-4" />
                      {deadline}
                    </div>
                  </div>
                ))}
              </div>
              <div className="liquid-glass rounded-xl border-black/10 bg-[#fffdf7]/76 p-5">
                <p className="text-xs uppercase text-[#3f4a45]">
                  Why prioritized
                </p>
                <p className="mt-3 text-lg font-semibold leading-7">
                  Asks for a response and includes a specific deadline.
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e6e0d4]">
                  <div className="h-full w-[87%] rounded-l-full bg-[#0e6f68]" />
                </div>
                <p className="mt-2 text-xs font-medium text-white/82">
                  87% local confidence
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section
        id="uses"
        className="landing-section section-fade relative border-y border-black/10 bg-[#111614] px-5 py-24 text-[#f7f6f1] sm:px-8 lg:py-32"
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:80px_80px]" />
        <div className="relative mx-auto max-w-[1500px]">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <ScrollReveal className="lg:self-center" direction="left">
              <p className="text-sm uppercase text-[#8bd3c7]">What it does</p>
              <h2 className="mt-4 max-w-xl text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
                Three inboxes. One decision system.
              </h2>
            </ScrollReveal>

            <div className="grid gap-4">
              {useCases.map((item) => {
                const Icon = item.icon;
                return (
                  <ScrollReveal
                    key={item.title}
                    delay={Number(item.index) * 90}
                    direction="up"
                  >
                    <article className="group grid gap-6 border-t border-white/14 py-10 md:grid-cols-[120px_1fr] md:items-center">
                      <div className="flex items-center justify-between md:block">
                        <span className="text-5xl font-semibold text-white/18">
                          {item.index}
                        </span>
                        <span className="liquid-glass-dark flex size-12 items-center justify-center rounded-md text-[#8bd3c7] transition-transform duration-500 group-hover:translate-x-1">
                          <Icon className="size-5" />
                        </span>
                      </div>
                      <div>
                        <h3 className="text-3xl font-semibold tracking-normal">
                          {item.title}
                        </h3>
                        <p className="mt-3 max-w-2xl text-lg leading-8 text-white/62">
                          {item.description}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-2">
                          {item.categories.map((category) => (
                            <span
                              key={category}
                              className="rounded-md border border-white/12 bg-white/[0.03] px-3 py-1 text-sm text-white/68 backdrop-blur-md"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section section-fade relative px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto grid max-w-[1500px] gap-16 lg:grid-cols-[1fr_1fr] lg:items-center">
          <ScrollReveal className="relative min-h-[520px]" direction="left">
            <div className="float-slow absolute left-8 top-0 h-64 w-64 rounded-full border border-[#0e6f68]/18" />
            <div className="float-slower absolute bottom-10 right-6 h-44 w-44 rounded-full border border-[#a85d35]/18" />
            <div className="relative z-10 grid max-w-[560px] gap-4 pt-16">
            <div className="liquid-glass rounded-xl border-black/10 bg-white/76 p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-[#e7f1ec] text-[#155f59]">
                  <BadgeCheck className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">Action summary</p>
                  <p className="text-sm text-[#6d756f]">Confirm availability</p>
                </div>
              </div>
              <p className="mt-6 text-3xl font-semibold leading-tight">
                &quot;Reply before tomorrow at 5 PM to hold the interview
                slot.&quot;
              </p>
            </div>
            <div className="liquid-glass-dark rounded-xl p-6 text-[#f7f6f1]">
              <p className="text-sm uppercase text-white/45">Local analysis path</p>
              <div className="mt-5 grid gap-4">
                {[
                  "Keyword signal",
                  "Deadline signal",
                  "Mode weighting",
                  "Trust explanation",
                ].map((signal) => (
                  <div key={signal} className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-[#8bd3c7]" />
                    <span className="text-sm text-white/70">{signal}</span>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right">
            <p className="text-sm uppercase text-[#0e6f68]">Transparent triage</p>
            <h2 className="mt-4 text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
              Not a black box. A reviewable ranking.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4a504d]">
              The MVP uses deterministic local rules so every recommendation can
              be inspected. Later, an OpenAI-backed service can replace the
              local engine without changing the product workflow.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section
        id="privacy"
        className="landing-section section-fade bg-[#ede9df] px-5 py-24 sm:px-8 lg:py-32"
      >
        <div className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <ScrollReveal direction="left">
            <p className="text-sm uppercase text-[#8b4d2c]">
              Confidential by design
            </p>
            <h2 className="mt-4 text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
              Email data should stay under the user&apos;s control.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#4a504d]">
              InboxPilot is being designed for sensitive per-user inboxes. This
              website does not store email data, and the local MVP uses mock
              messages only.
            </p>
          </ScrollReveal>

          <div className="grid gap-3">
            {privacyPrinciples.map((principle, index) => (
              <ScrollReveal key={principle} delay={index * 90} direction="up">
                <div className="grid min-h-[90px] items-center gap-4 border-t border-black/12 py-0 sm:grid-cols-[64px_1fr]">
                  <span className="text-3xl font-semibold text-[#8b4d2c]/45">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-4 self-center">
                    <ShieldCheck className="size-5 shrink-0 text-[#0e6f68]" />
                    <p className="text-xl font-medium leading-8">{principle}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section section-fade relative px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-[1500px]">
          <ScrollReveal>
            <div className="liquid-glass-dark rounded-[2rem] p-8 text-[#f7f6f1] sm:p-12 lg:p-16">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                <div>
                  <p className="text-sm uppercase text-[#8bd3c7]">Begin now</p>
                  <h2 className="mt-4 max-w-4xl text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
                    Connect later. Preview safely today.
                  </h2>
                  <p className="mt-6 max-w-2xl text-lg leading-8 text-white/62">
                    Start at the connections page to see the planned Gmail,
                    Outlook, and Yahoo sign-in paths. In this version, those
                    providers remain off and no mailbox content is stored.
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[LockKeyhole, Fingerprint, CircleDollarSign].map(
                      (Icon, index) => (
                        <span
                          key={index}
                          className="liquid-glass-dark flex aspect-square items-center justify-center rounded-xl"
                        >
                          <Icon className="size-6 text-[#8bd3c7]" />
                        </span>
                      ),
                    )}
                  </div>
                  <Link
                    href="/connections"
                    className={buttonVariants({
                      size: "lg",
                      className:
                        "h-12 bg-[#f7f6f1] text-[#111614] hover:bg-white",
                    })}
                  >
                    Begin now
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}

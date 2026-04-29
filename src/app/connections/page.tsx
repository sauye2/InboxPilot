import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const providers = [
  {
    name: "Gmail",
    detail: "Read-only Gmail OAuth is available for signed-in users. Tokens are not persisted until encrypted storage is added.",
    status: "Read-only beta",
    href: "/api/email-providers/gmail/start",
    disabled: false,
  },
  {
    name: "Outlook / Microsoft 365",
    detail: "Planned Microsoft Graph adapter. Not enabled in this local MVP.",
    status: "Coming soon",
    disabled: true,
  },
  {
    name: "Yahoo Mail",
    detail: "Planned provider-specific or IMAP adapter after security review.",
    status: "Coming soon",
    disabled: true,
  },
];

type ConnectionsPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function ConnectionsPage({ searchParams }: ConnectionsPageProps) {
  const [{ message }, supabase] = await Promise.all([
    searchParams,
    createSupabaseServerClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: connections } = user
    ? await supabase
        .from("email_connections")
        .select("provider, provider_account_email, status")
        .eq("user_id", user.id)
    : { data: [] };
  const connectionByProvider = new Map(
    (connections ?? []).map((connection) => [connection.provider, connection]),
  );

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:py-12">
        <section className="liquid-glass-dark grid gap-8 rounded-2xl p-6 text-[#f7f6f1] sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:p-14">
          <div>
            <Badge className="rounded-md bg-[#193d38] text-[#8bd3c7] hover:bg-[#193d38]">
              Connection center
            </Badge>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
              Connect only what you choose.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/64">
              InboxPilot now supports the first Gmail OAuth path for signed-in
              users. This first pass requests read-only access and does not store
              full email bodies by default.
            </p>
            {message ? (
              <div className="mt-6 rounded-lg border border-[#8bd3c7]/20 bg-[#8bd3c7]/12 px-4 py-3 text-sm text-[#8bd3c7]">
                {message}
              </div>
            ) : null}
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
              <p>OAuth credentials stay server-side.</p>
              <p>Gmail requires explicit Google consent.</p>
              <p>No full email body is retained by default.</p>
              <p>Mock data powers the current triage experience.</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {providers.map((provider) => {
            const connection = connectionByProvider.get(
              provider.name === "Gmail" ? "gmail" : "",
            );
            const isConnected = connection?.status === "connected";

            return (
              <article
                key={provider.name}
                className="liquid-glass rounded-2xl border-black/10 bg-white/66 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/70 shadow-sm ring-1 ring-black/5">
                    <ProviderLogo name={provider.name} />
                  </span>
                  <Badge className="bg-[#ede9df] text-[#4a504d] hover:bg-[#ede9df]">
                    {isConnected ? "Connected" : provider.status}
                  </Badge>
                </div>
                <h2 className="mt-5 text-xl font-semibold text-[#141817]">
                  {provider.name}
                </h2>
                <p className="mt-3 min-h-16 text-sm leading-6 text-[#4a504d]">
                  {isConnected
                    ? `Connected as ${connection.provider_account_email}`
                    : provider.detail}
                </p>
                {provider.disabled ? (
                  <button
                    disabled
                    className="mt-5 flex h-11 w-full items-center justify-center rounded-md border border-black/10 bg-[#ede9df]/70 text-sm font-medium text-[#7d8680]"
                  >
                    Sign in unavailable
                  </button>
                ) : (
                  <Link
                    href={user ? provider.href ?? "#" : "/login?next=/connections"}
                    className={buttonVariants({
                      size: "lg",
                      className:
                        "mt-5 h-11 w-full bg-[#141817] text-[#f7f6f1] hover:bg-[#27302d]",
                    })}
                  >
                    {isConnected ? "Reconnect Gmail" : "Connect Gmail"}
                  </Link>
                )}
              </article>
            );
          })}
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

function ProviderLogo({ name }: { name: string }) {
  if (name === "Gmail") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="size-8"
        role="img"
      >
        <path
          fill="#4285f4"
          d="M8 39h7V21.5L5 14v22c0 1.7 1.3 3 3 3Z"
        />
        <path
          fill="#34a853"
          d="M33 39h7c1.7 0 3-1.3 3-3V14l-10 7.5V39Z"
        />
        <path
          fill="#fbbc04"
          d="M33 14v7.5L43 14v-2.5c0-3.8-4.3-6-7.4-3.7L33 9.8V14Z"
        />
        <path
          fill="#ea4335"
          d="M15 21.5V14l9 6.8 9-6.8V9.8l-9 6.8-9-6.8V14Z"
        />
        <path
          fill="#c5221f"
          d="M5 11.5V14l10 7.5V14l-2.6-2.2C9.3 9.5 5 7.7 5 11.5Z"
        />
      </svg>
    );
  }

  if (name.startsWith("Outlook")) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="size-8"
        role="img"
      >
        <defs>
          <linearGradient id="outlookBack" x1="8" x2="42" y1="9" y2="39">
            <stop stopColor="#37d5ff" />
            <stop offset="0.48" stopColor="#2a7be4" />
            <stop offset="1" stopColor="#2535c7" />
          </linearGradient>
          <linearGradient id="outlookFront" x1="7" x2="26" y1="17" y2="39">
            <stop stopColor="#159bf3" />
            <stop offset="1" stopColor="#1845b7" />
          </linearGradient>
        </defs>
        <path
          fill="url(#outlookBack)"
          d="M18.2 7.4h19.2c3 0 5.4 2.4 5.4 5.4v22.4c0 3-2.4 5.4-5.4 5.4H18.2c-3 0-5.4-2.4-5.4-5.4V12.8c0-3 2.4-5.4 5.4-5.4Z"
          transform="rotate(-35 27.8 24)"
        />
        <path
          fill="#5bd7ef"
          opacity="0.72"
          d="M13 15.7 24 24l-11 8.3V15.7Z"
        />
        <path
          fill="#0b8fe8"
          opacity="0.75"
          d="M43 15.7 28 24l15 8.3V15.7Z"
        />
        <rect
          x="5"
          y="18"
          width="21"
          height="22"
          rx="4"
          fill="url(#outlookFront)"
        />
        <path
          fill="#fff"
          d="M15.4 34.8c-4 0-6.8-3.1-6.8-7.1s2.8-7.1 6.8-7.1 6.8 3.1 6.8 7.1-2.8 7.1-6.8 7.1Zm0-3.1c2 0 3.3-1.6 3.3-4s-1.3-4-3.3-4-3.3 1.6-3.3 4 1.3 4 3.3 4Z"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="size-8"
      role="img"
    >
      <rect width="48" height="48" rx="12" fill="#5f01d1" />
      <path
        fill="#fff"
        d="M13.5 14h6.1l4.3 8.1L28.2 14h6L26.7 27.2V35h-5.6v-7.8L13.5 14Zm21.1 14.8h-5.2L30.1 14h6.2l-1.7 14.8Zm-5.4 6.2c0-1.8 1.3-3.1 3.1-3.1 1.7 0 3 1.3 3 3.1 0 1.7-1.3 3-3 3-1.8 0-3.1-1.3-3.1-3Z"
      />
    </svg>
  );
}

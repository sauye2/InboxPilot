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
                  <span className="flex size-11 items-center justify-center rounded-lg bg-[#e7f1ec]">
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
      <span className="relative flex size-6 items-center justify-center">
        <span className="absolute h-4 w-5 rounded-sm border-2 border-[#d93025]" />
        <span className="absolute left-[3px] top-[5px] h-2.5 w-2.5 rotate-45 border-b-2 border-r-2 border-[#1a73e8]" />
        <span className="absolute right-[3px] top-[5px] h-2.5 w-2.5 -rotate-45 border-b-2 border-l-2 border-[#188038]" />
      </span>
    );
  }

  if (name.startsWith("Outlook")) {
    return (
      <span className="relative flex size-6 items-center justify-center rounded bg-[#0f6cbd] text-[13px] font-bold text-white shadow-sm">
        O
        <span className="absolute -right-1 bottom-1 h-3 w-4 rounded-sm bg-[#28a8ea]" />
      </span>
    );
  }

  return (
    <span className="flex size-6 items-center justify-center rounded bg-[#6001d2] text-[15px] font-bold text-white shadow-sm">
      Y!
    </span>
  );
}

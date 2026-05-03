import Link from "next/link";
import Image from "next/image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { revokeGmailToken } from "@/lib/email-providers/gmail-oauth";
import { decryptSecret } from "@/lib/security/encryption";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { auditProviderEvent } from "@/lib/supabase/triage-persistence";

const providers = [
  {
    id: "gmail",
    name: "Gmail",
    detail: "Gmail OAuth is available for signed-in users. InboxPilot can scan recent messages and send explicitly approved replies.",
    status: "Gmail beta",
    href: "/api/email-providers/gmail/start",
    disabled: false,
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    detail: "Microsoft Graph OAuth is available for signed-in users. InboxPilot can scan recent Outlook inbox messages and send explicitly approved replies.",
    status: "Outlook beta",
    href: "/api/email-providers/outlook/start",
    disabled: false,
  },
  {
    id: "yahoo",
    name: "Yahoo Mail",
    detail: "Planned provider-specific or IMAP adapter after security review.",
    status: "Coming soon",
    disabled: true,
  },
];

const providerLogoAssets: Record<
  string,
  { src: string; alt: string; imageClassName: string; frameClassName: string }
> = {
  Gmail: {
    src: "/provider-logos/gmail.svg",
    alt: "Gmail logo",
    imageClassName: "h-7 w-9 object-contain",
    frameClassName: "bg-white/78",
  },
  "Outlook / Microsoft 365": {
    src: "/provider-logos/outlook.svg",
    alt: "Microsoft Outlook logo",
    imageClassName: "size-9 object-contain",
    frameClassName: "bg-white/78",
  },
  "Yahoo Mail": {
    src: "/provider-logos/yahoo-mail.png",
    alt: "Yahoo Mail logo",
    imageClassName: "size-12 rounded-xl object-contain",
    frameClassName: "overflow-hidden bg-white/78",
  },
};

async function disconnectGmailAction() {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/connections");

  const admin = createSupabaseAdminClient();
  const { data: connection } = await admin
    .from("email_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "gmail")
    .maybeSingle();

  if (connection?.id) {
    const { data: token } = await admin
      .from("email_connection_tokens")
      .select("encrypted_refresh_token, encryption_iv, encryption_tag")
      .eq("connection_id", connection.id)
      .maybeSingle();

    if (token) {
      try {
        const refreshToken = decryptSecret({
          ciphertext: token.encrypted_refresh_token,
          iv: token.encryption_iv,
          tag: token.encryption_tag,
        });
        await revokeGmailToken(refreshToken);
        await auditProviderEvent({
          admin,
          userId: user.id,
          connectionId: connection.id,
          provider: "gmail",
          eventType: "revoked",
          message: "Gmail refresh token revoked at Google.",
        });
      } catch (error) {
        await auditProviderEvent({
          admin,
          userId: user.id,
          connectionId: connection.id,
          provider: "gmail",
          eventType: "revoked",
          message:
            error instanceof Error
              ? `Local disconnect completed; Google revoke failed: ${error.message}`
              : "Local disconnect completed; Google revoke failed.",
        });
      }
    }

    await admin
      .from("email_connection_tokens")
      .delete()
      .eq("connection_id", connection.id);
    await admin.from("email_connections").delete().eq("id", connection.id);
  }

  revalidatePath("/connections");
}

async function disconnectOutlookAction() {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/connections");

  const admin = createSupabaseAdminClient();
  const { data: connection } = await admin
    .from("email_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "outlook")
    .maybeSingle();

  if (connection?.id) {
    await auditProviderEvent({
      admin,
      userId: user.id,
      connectionId: connection.id,
      provider: "outlook",
      eventType: "revoked",
      message: "Outlook disconnected locally; encrypted refresh token removed.",
    });
    await admin
      .from("email_connection_tokens")
      .delete()
      .eq("connection_id", connection.id);
    await admin.from("email_connections").delete().eq("id", connection.id);
  }

  revalidatePath("/connections");
}

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
              InboxPilot supports secure Gmail and Outlook access for signed-in
              users. It scans recent messages and only sends a reply after you
              approve the editable draft.
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
                Open dashboard
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
                <p className="text-sm text-white/52">Secure provider access</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 text-sm leading-6 text-white/68">
              <p>OAuth credentials stay encrypted and server-side.</p>
              <p>Gmail requires explicit Google consent.</p>
              <p>Replies are only sent after direct approval.</p>
              <p>No full email body is retained by default.</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {providers.map((provider) => {
            const connection = connectionByProvider.get(
              provider.id,
            );
            const isConnected = connection?.status === "connected";

            return (
              <article
                key={provider.name}
                className="liquid-glass flex min-h-[278px] flex-col rounded-2xl border-black/10 bg-white/66 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`flex size-12 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5 ${
                      providerLogoAssets[provider.name]?.frameClassName ?? "bg-white/78"
                    }`}
                  >
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
                <div className="mt-auto pt-5">
                  {isConnected ? (
                    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-black/8 bg-[#ede9df]/58 px-3 py-2 text-[#4a504d] shadow-inner shadow-white/20">
                      <p className="min-w-0 flex flex-1 items-center gap-2 truncate text-[11px] leading-5 text-[#4a504d]">
                        <span className="shrink-0 font-semibold text-[#68716d]">
                          Signed in as
                        </span>{" "}
                        <span className="min-w-0 truncate rounded-md border border-black/10 bg-[#fffdf7]/74 px-2 py-1 font-medium text-[#141817]">
                          {connection.provider_account_email}
                        </span>
                      </p>
                      <form
                        action={
                          provider.id === "outlook"
                            ? disconnectOutlookAction
                            : disconnectGmailAction
                        }
                        className="shrink-0"
                      >
                        <button
                          type="submit"
                          className="h-7 rounded-md border border-[#c86a3b]/20 bg-[#fff1e8] px-2.5 text-[11px] font-semibold text-[#9a4d2c] transition hover:bg-[#ffe6d7] hover:text-[#7d351d]"
                        >
                          Sign out
                        </button>
                      </form>
                    </div>
                  ) : provider.disabled ? (
                    <button
                      disabled
                      className="flex h-11 w-full items-center justify-center rounded-md border border-black/10 bg-[#ede9df]/70 text-sm font-medium text-[#7d8680]"
                    >
                      Sign in unavailable
                    </button>
                  ) : (
                    <Link
                      href={user ? provider.href ?? "#" : "/login?next=/connections"}
                      className={buttonVariants({
                        size: "lg",
                        className:
                          "h-11 w-full bg-[#141817] text-[#f7f6f1] hover:bg-[#27302d]",
                      })}
                    >
                      {provider.id === "outlook" ? "Connect Outlook" : "Connect Gmail"}
                    </Link>
                  )}
                </div>
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
  const logo = providerLogoAssets[name] ?? providerLogoAssets.Gmail;
  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={40}
      height={40}
      className={logo.imageClassName}
      unoptimized={name === "Yahoo Mail"}
    />
  );
}

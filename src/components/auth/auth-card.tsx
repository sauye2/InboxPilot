import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthCardProps = {
  mode: "login" | "signup";
  action: (formData: FormData) => void | Promise<void>;
  message?: string;
  next?: string;
};

export function AuthCard({ mode, action, message, next = "/dashboard" }: AuthCardProps) {
  const isLogin = mode === "login";

  return (
    <main className="relative mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-[1500px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_480px] lg:items-center lg:py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10rem] top-20 h-[34rem] w-[34rem] rounded-full border border-[#0e6f68]/15" />
        <div className="absolute right-[-8rem] top-24 h-[26rem] w-[26rem] rounded-full border border-[#a85d35]/12" />
      </div>

      <section className="liquid-glass-dark rounded-2xl p-7 text-[#f7f6f1] sm:p-10 lg:p-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#8bd3c7]/20 bg-[#8bd3c7]/12 px-3 py-1.5 text-xs font-medium text-[#8bd3c7]">
          <ShieldCheck className="size-3.5" />
          Secure account layer
        </div>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-normal sm:text-6xl">
          {isLogin ? "Welcome back to InboxPilot." : "Create your InboxPilot account."}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/64">
          {isLogin
            ? "Sign in to keep workflow preferences, review actions, and future saved triage results attached to your account."
            : "Start with a private account foundation. Real mailbox access still requires explicit connection and consent later."}
        </p>
        <div className="mt-8 grid gap-3 text-sm leading-6 text-white/68">
          <div className="flex gap-3">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-[#8bd3c7]" />
            Password auth is handled by Supabase.
          </div>
          <div className="flex gap-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-[#8bd3c7]" />
            Email provider connections remain separate from app login.
          </div>
        </div>
      </section>

      <section className="liquid-glass rounded-2xl border-black/10 bg-white/68 p-5 shadow-2xl shadow-black/10 ring-1 ring-white/50 sm:p-6">
        <div className="rounded-xl border border-black/10 bg-[#fffdf7]/80 p-5">
          <p className="text-sm font-semibold uppercase text-[#0e6f68]">
            {isLogin ? "Sign in" : "Sign up"}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-[#141817]">
            {isLogin ? "Open your workspace" : "Reserve your workspace"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#68716d]">
            This does not connect Gmail, Outlook, Yahoo, or store real inbox content.
          </p>

          {message ? (
            <div className="mt-5 rounded-lg border border-[#0e6f68]/20 bg-[#e7f1ec] px-3 py-2 text-sm text-[#155f59]">
              {message}
            </div>
          ) : null}

          <form action={action} className="mt-6 grid gap-4">
            <input type="hidden" name="next" value={next} />
            <label className="grid gap-2 text-sm font-medium text-[#26302c]">
              Email
              <Input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="h-11 border-black/10 bg-white/80 px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#26302c]">
              Password
              <Input
                name="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="h-11 border-black/10 bg-white/80 px-3"
              />
            </label>
            <Button
              type="submit"
              size="lg"
              className="mt-2 h-11 bg-[#141817] text-[#f7f6f1] hover:bg-[#27302d]"
            >
              {isLogin ? "Sign in" : "Create account"}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-[#68716d]">
            {isLogin ? "No account yet?" : "Already have an account?"}{" "}
            <Link
              href={isLogin ? `/signup?next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`}
              className="font-semibold text-[#0e6f68] underline-offset-4 hover:underline"
            >
              {isLogin ? "Create one" : "Sign in"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

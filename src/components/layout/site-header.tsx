import Link from "next/link";
import { LogIn, LogOut, Plane, Settings, ShieldCheck, Unplug } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
      <div className="liquid-glass mx-auto flex h-16 max-w-[1500px] items-center justify-between rounded-xl bg-[#f7f6f1]/70 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-[#141817] text-[#f7f6f1] shadow-sm">
            <Plane className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold leading-4">
              InboxPilot
            </span>
            <span className="block text-xs text-[#68716d]">
              Local triage preview
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <Link
            href="/dashboard"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "text-[#4a504d] hover:bg-black/5 hover:text-[#141817]",
            })}
          >
            Dashboard
          </Link>
          <Link
            href="/connections"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "text-[#4a504d] hover:bg-black/5 hover:text-[#141817]",
            })}
          >
            <Unplug className="size-4" />
            Connections
          </Link>
          <Link
            href="/settings"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "text-[#4a504d] hover:bg-black/5 hover:text-[#141817]",
            })}
          >
            <Settings className="size-4" />
            Settings
          </Link>
        </nav>

        {user ? (
          <form action={signOutAction} className="flex items-center gap-2">
            <div className="hidden max-w-[220px] truncate rounded-full border border-[#0e6f68]/20 bg-[#e7f1ec] px-3 py-1.5 text-xs font-medium text-[#155f59] sm:block">
              {user.email}
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-black/10 bg-white/50 text-[#4a504d] hover:bg-white/80"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-[#0e6f68]/20 bg-[#e7f1ec] px-3 py-1.5 text-xs font-medium text-[#155f59] lg:flex">
              <ShieldCheck className="size-3.5" />
              Mock data only
            </div>
            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "border-black/10 bg-white/50 text-[#4a504d] hover:bg-white/80",
              })}
            >
              <LogIn className="size-3.5" />
              Sign in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

import Link from "next/link";
import { LogIn, Plane, Settings, ShieldCheck, User, Unplug } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open account menu"
              className="flex size-10 items-center justify-center rounded-full border border-[#d8d1c4] bg-[#fffdf7] text-[#141817] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0e6f68]/20"
            >
              <User className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="liquid-glass w-48 rounded-xl border-black/10 bg-[#fffdf7]/92 p-1.5 text-[#141817] shadow-2xl shadow-black/15"
            >
              <div className="rounded-lg bg-[#ede9df]/82 px-3 py-2.5">
                <p className="text-xs font-semibold leading-4">Signed in</p>
                <p className="mt-0.5 truncate text-[11px] text-[#68716d]">
                  {user.email}
                </p>
              </div>
              <form action={signOutAction}>
                <DropdownMenuItem
                  className="mt-1 h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold text-[#141817] focus:bg-[#ede9df]"
                  render={<button type="submit" className="w-full text-left" />}
                >
                  Sign out
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
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

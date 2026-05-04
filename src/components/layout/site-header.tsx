import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  LogIn,
  Settings,
  ShieldCheck,
  User,
  Unplug,
} from "lucide-react";
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
      <div className="liquid-glass mx-auto grid h-16 max-w-[1500px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-xl bg-[#f7f6f1]/70 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center justify-self-start">
          <Image
            src="/brand/inboxpilot-horizontal-dark.svg"
            alt="InboxPilot"
            width={224}
            height={76}
            className="h-11 w-auto drop-shadow-sm sm:h-12"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-3 justify-self-center md:flex">
          <Link
            href="/dashboard"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "text-[#4a504d] hover:bg-black/5 hover:text-[#141817]",
            })}
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </Link>
          <span
            aria-hidden="true"
            className="h-5 w-px rounded-full bg-[#d8d1c4]"
          />
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
          <span
            aria-hidden="true"
            className="h-5 w-px rounded-full bg-[#d8d1c4]"
          />
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
          <div className="justify-self-end">
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
          </div>
        ) : (
          <div className="flex items-center gap-2 justify-self-end">
            <div className="hidden items-center gap-2 rounded-full border border-[#0e6f68]/20 bg-[#e7f1ec] px-3 py-1.5 text-xs font-medium text-[#155f59] lg:flex">
              <ShieldCheck className="size-3.5" />
              Privacy first
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

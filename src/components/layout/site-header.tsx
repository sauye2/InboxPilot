import Link from "next/link";
import { Plane, Settings, ShieldCheck, Unplug } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
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

        <div className="flex items-center gap-2 rounded-full border border-[#0e6f68]/20 bg-[#e7f1ec] px-3 py-1.5 text-xs font-medium text-[#155f59]">
          <ShieldCheck className="size-3.5" />
          <span className="hidden sm:inline">Mock data only</span>
          <span className="sm:hidden">Mock</span>
        </div>
      </div>
    </header>
  );
}

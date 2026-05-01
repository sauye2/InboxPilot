import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-[#f7f6f1] text-[#141817]">
      <div className="app-ambient-bg pointer-events-none fixed inset-0 z-0" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-28 bg-gradient-to-b from-[#fffdf7]/90 to-transparent" />
      <div className="relative z-10">
        <SiteHeader />
        {children}
        <footer className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 pb-8 pt-4 text-[11px] text-[#68716d] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>InboxPilot processes connected email only with explicit user permission.</p>
          <nav className="flex items-center gap-3">
            <Link href="/privacy" className="transition hover:text-[#0e6f68]">
              Privacy Policy
            </Link>
            <span className="h-3 w-px bg-black/15" />
            <Link href="/terms" className="transition hover:text-[#0e6f68]">
              Terms of Service
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

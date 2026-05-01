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
      </div>
    </div>
  );
}

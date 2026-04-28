import { SiteHeader } from "@/components/layout/site-header";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh overflow-hidden bg-[#f7f6f1] text-[#141817]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-10rem] top-24 h-[34rem] w-[34rem] rounded-full border border-[#0e6f68]/15" />
        <div className="absolute right-[-12rem] top-12 h-[30rem] w-[30rem] rounded-full border border-[#a85d35]/12" />
      </div>
      <SiteHeader />
      {children}
    </div>
  );
}

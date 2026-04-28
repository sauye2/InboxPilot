import { AppShell } from "@/components/layout/app-shell";
import { AuthCard } from "@/components/auth/auth-card";
import { signInAction } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <AuthCard
        mode="login"
        action={signInAction}
        message={params.message}
        next={params.next ?? "/dashboard"}
      />
    </AppShell>
  );
}

import { AppShell } from "@/components/layout/app-shell";
import { AuthCard } from "@/components/auth/auth-card";
import { signUpAction } from "@/app/auth/actions";

type SignupPageProps = {
  searchParams: Promise<{
    message?: string;
    next?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <AuthCard
        mode="signup"
        action={signUpAction}
        message={params.message}
        next={params.next ?? "/dashboard"}
      />
    </AppShell>
  );
}

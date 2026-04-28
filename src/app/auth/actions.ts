"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  next: z.string().optional(),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function authRedirect(path: string, message: string, next?: string): never {
  const params = new URLSearchParams({ message });
  if (next) params.set("next", next);
  redirect(`${path}?${params.toString()}`);
}

export async function signInAction(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    next: formValue(formData, "next") || "/dashboard",
  });

  if (!parsed.success) {
    authRedirect("/login", parsed.error.issues[0]?.message ?? "Unable to sign in.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    authRedirect("/login", error.message, parsed.data.next);
  }

  revalidatePath("/", "layout");
  redirect(parsed.data.next ?? "/dashboard");
}

export async function signUpAction(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    next: formValue(formData, "next") || "/dashboard",
  });

  if (!parsed.success) {
    authRedirect("/signup", parsed.error.issues[0]?.message ?? "Unable to create account.");
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
        parsed.data.next ?? "/dashboard",
      )}`,
    },
  });

  if (error) {
    authRedirect("/signup", error.message, parsed.data.next);
  }

  authRedirect(
    "/login",
    "Check your email to confirm your account, then sign in.",
    parsed.data.next,
  );
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

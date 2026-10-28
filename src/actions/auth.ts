import { createClient } from "@/lib/supabase/client";
import { appUrl, redirect, safeNext } from "@/lib/nav";
import { clearWorkspace } from "@/lib/workspace";
import { str } from "@/lib/utils";
import type { ActionState } from "@/lib/types";

/** Where Supabase sends people back to after email links and Google sign-in. */
function callbackUrl(next: string) {
  return appUrl(`/auth/callback/?next=${encodeURIComponent(next)}`);
}

export async function signIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email");
  const password = str(fd, "password");
  if (!email || !password) return { error: "Enter your email and password." };
  const { error } = await createClient().auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect(safeNext(str(fd, "next")));
  return { ok: true };
}

export async function signUp(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email");
  const password = str(fd, "password");
  const fullName = str(fd, "full_name");
  if (!email || !password) return { error: "Enter your email and a password." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  const next = safeNext(str(fd, "next"));
  const { data, error } = await createClient().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: callbackUrl(next) },
  });
  if (error) return { error: error.message };
  if (!data.session) return { ok: true, message: "Check your inbox to confirm your email, then sign in." };
  redirect(next);
  return { ok: true };
}

export async function signInWithMagicLink(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email");
  if (!email) return { error: "Enter your email." };
  const { error } = await createClient().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(safeNext(str(fd, "next"))) },
  });
  if (error) return { error: error.message };
  return { ok: true, message: "Magic link sent — check your inbox." };
}

export async function signInWithGoogle(fd: FormData) {
  const { data, error } = await createClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(safeNext(str(fd, "next"))), skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    redirect(`/login/?error=${encodeURIComponent(error?.message ?? "Google sign-in failed")}`);
    return;
  }
  window.location.assign(data.url);
}

export async function signOut() {
  await createClient().auth.signOut();
  clearWorkspace();
  redirect("/login/");
}

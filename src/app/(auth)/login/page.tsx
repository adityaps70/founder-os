"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "../auth-form";
import { useRedirectIfSignedIn } from "../use-redirect";

function Login() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? undefined;
  useRedirectIfSignedIn(next);
  return <AuthForm mode="login" next={next} error={sp.get("error") ?? undefined} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

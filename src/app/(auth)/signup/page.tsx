"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "../auth-form";
import { useRedirectIfSignedIn } from "../use-redirect";

function Signup() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? undefined;
  useRedirectIfSignedIn(next);
  return <AuthForm mode="signup" next={next} />;
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <Signup />
    </Suspense>
  );
}

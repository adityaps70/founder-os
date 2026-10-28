"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { navigate, safeNext } from "@/lib/nav";

/** Already signed in? Skip the login/signup form. */
export function useRedirectIfSignedIn(next?: string) {
  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) navigate(safeNext(next), { replace: true });
      });
  }, [next]);
}

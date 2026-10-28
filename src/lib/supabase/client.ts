"use client";
import { createClient as createSupabaseClient, FunctionRegion, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Browser Supabase client (singleton). Sessions live in localStorage; RLS protects all data. */
export function createClient(): SupabaseClient {
  if (!client) {
    client = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

/** Calls the `founder-api` Edge Function (AI Copilot, morning brief, plan changes), pinned to Mumbai. */
export async function callApi<T extends Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<({ ok: true } & T) | { ok: false; error: string }> {
  const { data, error } = await createClient().functions.invoke("founder-api", { body, region: FunctionRegion.ApSouth1 });
  if (error) {
    // Non-2xx: try to read the JSON error the function sent.
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      if (j?.error) return { ok: false, error: String(j.error) };
    } catch {
      /* ignore */
    }
    return { ok: false, error: "Couldn't reach the Founder OS API. Check that the founder-api Edge Function is deployed." };
  }
  return data as ({ ok: true } & T) | { ok: false; error: string };
}

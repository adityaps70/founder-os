import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type OtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

/**
 * Email link handler for Supabase's token-hash templates (invites, magic links, confirmations).
 * Set your Supabase email templates to link to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next={{ .RedirectTo }}
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as OtpType | null;
  let next = searchParams.get("next") ?? "/app";
  // RedirectTo may be an absolute URL on our own origin — keep only the path.
  try {
    const u = new URL(next, origin);
    next = u.origin === origin ? u.pathname + u.search : "/app";
  } catch {
    next = "/app";
  }

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("That link is invalid or has expired.")}`);
}

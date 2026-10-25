import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPasswordLinkValid } from "@/lib/passwordLink";

// GET /api/auth/confirm?token_hash=...&exp=...&sig=...
// Public by design: this is where the emailed link lands. The signed expiry is
// checked first (1 hour, see lib/passwordLink.js), then the one-time token is
// exchanged for a session (cookies) and the person goes to the forced password
// change page. Expired, tampered or used links go back to login with a message.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");

  const failed = NextResponse.redirect(`${origin}/login?error=link_invalid`);
  if (!isPasswordLinkValid(tokenHash, searchParams.get("exp"), searchParams.get("sig"))) return failed;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (error) return failed;

  return NextResponse.redirect(`${origin}/set-password`);
}

import { createHmac, timingSafeEqual } from "crypto";

/*
 * One-time "set your password" link. The email points at our own
 * /api/auth/confirm route, which signs the person in and sends them to the
 * forced password change page.
 *
 * Lifetime is enforced here, not by a dashboard setting: the link carries an
 * expiry time and an HMAC signature over (token, expiry), so it cannot be
 * extended or forged, and bad links are rejected before Supabase is called.
 * Supabase's own Email OTP expiration remains as a second limit. Each link
 * works once, and a newer link replaces any older one.
 *
 * Server only: needs the service role key.
 */
export const LINK_TTL_SECONDS = 60 * 60; // 1 hour

function sign(tokenHash, exp) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(`${tokenHash}.${exp}`)
    .digest("hex");
}

export async function createPasswordLink(admin, { userId, email }) {
  // Server-only metadata: the middleware keeps this user on /set-password until it clears.
  // Set before the link is generated so nothing after generateLink can touch the token.
  const { error: flagError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { must_change_password: true },
  });
  if (flagError) throw flagError;

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw error;

  const tokenHash = data.properties.hashed_token;
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const params = new URLSearchParams({ token_hash: tokenHash, exp: String(exp), sig: sign(tokenHash, exp) });
  return `${appUrl}/api/auth/confirm?${params}`;
}

// True only for an untampered link that has not passed its expiry time.
export function isPasswordLinkValid(tokenHash, exp, sig) {
  const expNum = Number(exp);
  if (!tokenHash || !sig || !Number.isInteger(expNum)) return false;
  if (expNum < Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(sign(tokenHash, expNum), "hex");
  const given = Buffer.from(String(sig), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

import { headers } from "next/headers";

/*
  Reads identity middleware.js already verified and forwarded via request
  headers, so pages can skip re-querying profiles. Returns null if the
  headers are missing so callers can fall back to querying Supabase.
*/
export async function getAuthHeaders() {
  const h = await headers();
  const userId = h.get("x-user-id");
  const role = h.get("x-user-role");
  const status = h.get("x-user-status");
  const rawName = h.get("x-user-name");
  const rawEmail = h.get("x-user-email");

  if (!userId || !role) return null;

  return {
    userId,
    role,
    status,
    fullName: rawName ? decodeURIComponent(rawName) : "",
    email: rawEmail ? decodeURIComponent(rawEmail) : "",
  };
}
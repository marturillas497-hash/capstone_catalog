import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/*
  Shared session, role and status check for API routes.

  middleware.js does not run on /api/*, so every route has to verify the
  caller itself. Checking profiles.status here is what actually stops a
  suspended (or pending/rejected) account that still holds a valid session
  from calling the API directly.

  Usage:
    const auth = await requireActiveUser(["student", "capstone_adviser"]);
    if (auth.error) return auth.error;
    const { supabase, user, profile } = auth;

  One profile query covers role and status, so routes that already fetched
  the role pay no extra round trip by switching to this.
*/
export async function requireActiveUser(allowedRoles) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    return {
      error: NextResponse.json({ error: "Your account is not active." }, { status: 403 }),
    };
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }

  return { supabase, user, profile };
}

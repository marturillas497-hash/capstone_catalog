import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/auth/set-password   body: { password }
// For a signed-in user. Sets the new password and clears the must-change flag in
// one call. The flag lives in app_metadata, which only the service role can write.
export async function POST(request) {
  try {
    const auth = await requireActiveUser();
    if (auth.error) return auth.error;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const password = typeof body?.password === "string" ? body.password : "";
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: "Password must be 8 to 72 characters." }, { status: 400 });
    }

    const { error } = await createAdminClient().auth.admin.updateUserById(auth.user.id, {
      password,
      app_metadata: { must_change_password: false },
    });
    if (error) {
      // Auth rejects some passwords (for example the same as the old one): show its reason.
      const rejected = error.status === 422 || error.status === 400;
      console.error("[POST /api/auth/set-password]", error.message);
      return NextResponse.json(
        { error: rejected ? error.message : "Could not set the password. Please try again." },
        { status: rejected ? 400 : 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/set-password]", err.message);
    return NextResponse.json({ error: "Could not set the password. Please try again." }, { status: 500 });
  }
}

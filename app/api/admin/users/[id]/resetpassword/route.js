import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReadablePassword } from "@/lib/passwordWords";

// POST /api/admin/users/[id]/resetpassword
// Admin-assisted password reset (F16.6, F16.7). Unlike F15's Change
// Password, there is no reauthentication step, since the entire point
// of this action is that admin does not have and does not need the
// account's current password. Uses auth.admin.updateUserById() through
// the existing service role client, the same elevated access pattern
// already used for whitelist writes and abstract writes.
//
// The generated password is returned exactly once in this response.
// It is never written anywhere in plain text and never logged, on
// either the success path or the error path below.

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const admin = createAdminClient();

    const { data: target, error: fetchErr } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", id)
      .single();

    if (fetchErr || !target) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Only student and capstone_adviser accounts are managed from this
    // page. The admin account has its own Change Password flow (F15)
    // and should never be reset through this admin-assisted tool.
    if (!["student", "capstone_adviser"].includes(target.role)) {
      return NextResponse.json({ error: "Account is not a student or adviser" }, { status: 400 });
    }

    const newPassword = generateReadablePassword();

    const { error: updateErr } = await admin.auth.admin.updateUserById(id, {
      password: newPassword,
    });

    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true, password: newPassword, fullName: target.full_name });
  } catch (err) {
    // Deliberately not logging the generated password here or anywhere
    // above. err from a failed updateUserById call does not contain it.
    console.error("[POST /api/admin/users/[id]/resetpassword]", err);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
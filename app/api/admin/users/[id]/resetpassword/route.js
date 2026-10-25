import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPasswordLink } from "@/lib/passwordLink";
import { emailConfigured, sendPasswordLinkEmail } from "@/lib/email";

// POST /api/admin/users/[id]/resetpassword
// Admin-assisted password reset (F16.6, F16.7). The admin never sees or sets a
// password: this emails the person a one-time link (valid 1 hour) that signs them
// in and forces them to choose a new one. The current password is replaced with a
// random value nobody knows, so it stops working immediately.
//
// Order matters: the password is changed first, then the link is generated, so
// nothing that happens during the password change can invalidate the link.
export async function POST(request, { params }) {
  try {
    const auth = await requireActiveUser(["admin"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const admin = createAdminClient();

    const { data: target } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", id)
      .single();

    if (!target) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // The admin account has its own Change Password flow (F15) and is never reset here.
    if (!["student", "capstone_adviser", "staff"].includes(target.role)) {
      return NextResponse.json({ error: "Account is not a student, adviser or staff account" }, { status: 400 });
    }

    if (!emailConfigured()) {
      return NextResponse.json(
        { error: "Email is not set up on the server, so a reset link cannot be sent." },
        { status: 503 }
      );
    }

    const { data: authUser, error: userError } = await admin.auth.admin.getUserById(id);
    const email = authUser?.user?.email;
    if (userError || !email) {
      return NextResponse.json({ error: "Account has no email address" }, { status: 404 });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(id, {
      password: randomBytes(32).toString("hex"),
    });
    if (updateError) throw updateError;

    const link = await createPasswordLink(admin, { userId: id, email });
    await sendPasswordLinkEmail({ to: email, name: target.full_name, link, variant: "reset" });

    return NextResponse.json({ ok: true, fullName: target.full_name, email });
  } catch (err) {
    console.error("[POST /api/admin/users/[id]/resetpassword]", err.message);
    return NextResponse.json(
      { error: "Failed to send the reset link. Check the email settings and try again." },
      { status: 500 }
    );
  }
}

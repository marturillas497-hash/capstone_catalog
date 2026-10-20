import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/admin/users/[id]/status
// Flips profiles.status between active and suspended (F16.5).
// Shared by both the Students and Advisers tabs of /admin/users, since
// the operation is identical regardless of role, both values are already
// legal under the existing CHECK constraint, no schema change.
//
// No email is sent for either direction, matching the silent pattern
// already used by Change Password (F15.8). No audit trail is written,
// per the explicit decision made for this feature.

export async function PATCH(request, { params }) {
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
    const { action } = await request.json();

    if (!["suspend", "unsuspend"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: target, error: fetchErr } = await admin
      .from("profiles")
      .select("id, role, status")
      .eq("id", id)
      .single();

    if (fetchErr || !target) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Only student and capstone_adviser accounts are managed from this page.
    // The admin account itself is never a valid target here.
    if (!["student", "capstone_adviser"].includes(target.role)) {
      return NextResponse.json({ error: "Account is not a student or adviser" }, { status: 400 });
    }

    // Guards against acting on a pending or rejected adviser through this
    // route. Those statuses belong to the Approvals workflow (F8), not
    // to this one. Also guards against a double-fire on the same button,
    // e.g. two rapid clicks both trying to suspend an already-suspended row.
    if (action === "suspend" && target.status !== "active") {
      return NextResponse.json(
        { error: `Cannot suspend an account with status "${target.status}"` },
        { status: 400 }
      );
    }
    if (action === "unsuspend" && target.status !== "suspended") {
      return NextResponse.json(
        { error: `Cannot unsuspend an account with status "${target.status}"` },
        { status: 400 }
      );
    }

    const newStatus = action === "suspend" ? "suspended" : "active";
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("[PATCH /api/admin/users/[id]/status]", err);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
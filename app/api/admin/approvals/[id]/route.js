import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendAdviserDecisionEmail } from "@/lib/email";

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    if (!["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: target, error: fetchErr } = await admin
      .from("profiles")
      .select("id, full_name, role, status")
      .eq("id", id)
      .single();

    if (fetchErr || !target) {
      return NextResponse.json({ error: "Adviser not found" }, { status: 404 });
    }

    if (target.role !== "capstone_adviser") {
      return NextResponse.json({ error: "Target is not a capstone adviser" }, { status: 400 });
    }

    const newStatus = action === "approved" ? "active" : "rejected";
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", id);

    if (updateErr) throw updateErr;

    const { data: authUser } = await admin.auth.admin.getUserById(id);
    const email = authUser?.user?.email;

    /*
     * Runs after the response is sent, so the admin UI does not wait on SMTP
     * and a mail failure cannot undo a decision that is already saved.
     */
    if (email && emailConfigured()) {
      after(async () => {
        try {
          await sendAdviserDecisionEmail({ to: email, name: target.full_name, action });
        } catch (emailErr) {
          console.error("[approvals] Email send failed:", emailErr.message);
        }
      });
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("[PATCH /api/admin/approvals/[id]]", err);
    return NextResponse.json({ error: "Failed to process application" }, { status: 500 });
  }
}
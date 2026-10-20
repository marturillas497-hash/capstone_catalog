import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request, { params }) {
  const auth = await requireActiveUser(["student"]);
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;

  // Only the student whose ID matches can trigger this
  if (user.id !== id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // adviserId is either a UUID string or null/missing (meaning "no adviser").
  const rawAdviserId = body?.adviserId ?? null;
  if (rawAdviserId !== null && typeof rawAdviserId !== "string") {
    return NextResponse.json({ error: "Invalid adviser selected." }, { status: 400 });
  }
  const adviserId = rawAdviserId || null;

  const admin = createAdminClient();

  if (adviserId) {
    const { data: adviserProfile } = await admin
      .from("profiles")
      .select("role, status")
      .eq("id", adviserId)
      .single();

    const isValidAdviser =
      adviserProfile?.role === "capstone_adviser" && adviserProfile?.status === "active";

    if (!isValidAdviser) {
      return NextResponse.json({ error: "Invalid adviser selected." }, { status: 400 });
    }
  }

  const { error } = await admin
    .from("similarity_reports")
    .update({ adviser_id: adviserId })
    .eq("student_id", id);

  if (error) {
    console.error("Retroactive adviser update error:", error);
    return NextResponse.json({ error: "Failed to update reports." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

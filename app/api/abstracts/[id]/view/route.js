import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";

export async function POST(request, { params }) {
  // Only student views are tracked (the RLS insert policy enforces the same).
  const auth = await requireActiveUser(["student"]);
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const { id } = await params;

  const { error } = await supabase
    .from("abstract_views")
    .insert({ abstract_id: id, viewer_id: user.id });

  if (error && error.code !== "23505") {
    console.error("View tracking error:", error);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

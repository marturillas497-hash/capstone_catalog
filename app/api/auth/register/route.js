import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const body = await request.json();
  const { role, fullName, email, password, studentId, adviserId, agreedToTerms } = body;

  if (!role || !fullName || !email || !password) {
    return NextResponse.json({ error: "All required fields must be filled in." }, { status: 400 });
  }

  if (!["student", "capstone_adviser"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  if (!agreedToTerms) {
    return NextResponse.json(
      { error: "You must accept the Terms and Conditions to register." },
      { status: 400 }
    );
  }

  if (role === "student" && !studentId) {
    return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (role === "student") {
    const { data: whitelisted } = await admin
      .from("student_whitelist")
      .select("id_number")
      .eq("id_number", studentId.trim())
      .single();

    if (!whitelisted) {
      return NextResponse.json(
        { error: "Your student ID was not found in the system." },
        { status: 403 }
      );
    }

    const { data: existing } = await admin
      .from("student_metadata")
      .select("id_number")
      .eq("id_number", studentId.trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This student ID is already registered." },
        { status: 409 }
      );
    }
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes("already registered")) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const userId = authData.user.id;
  const status = role === "capstone_adviser" ? "pending" : "active";

  const { error: profileError } = await admin
    .from("profiles")
    .insert({
      id: userId,
      full_name: fullName.trim(),
      role,
      status,
      terms_accepted_at: new Date().toISOString(),
    });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Failed to create profile. Please try again." }, { status: 500 });
  }

  if (role === "student") {
    const { error: metaError } = await admin
      .from("student_metadata")
      .insert({
        profile_id: userId,
        id_number: studentId.trim(),
        adviser_id: adviserId || null,
      });

    if (metaError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Failed to save student details. Please try again." }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
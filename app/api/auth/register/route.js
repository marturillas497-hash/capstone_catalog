import { NextResponse, after } from "next/server";
import { emailConfigured, sendWelcomeEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const body = await request.json();
  const { role, fullName, email, password, studentId, adviserId, programId, agreedToTerms } = body;

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

  // A student's program comes from the registrar whitelist, never from the form.
  // An adviser picks theirs on the form. Admin and staff never register here.
  let programIdToSave = null;

  if (role === "capstone_adviser") {
    const { data: program } =
      typeof programId === "string" && programId
        ? await admin.from("programs").select("id").eq("id", programId).single()
        : { data: null };
    if (!program) {
      return NextResponse.json({ error: "Please select your program." }, { status: 400 });
    }
    programIdToSave = program.id;
  }

  if (role === "student") {
    const { data: whitelisted } = await admin
      .from("student_whitelist")
      .select("id_number, program_id")
      .eq("id_number", studentId.trim())
      .single();

    if (!whitelisted) {
      return NextResponse.json(
        { error: "Your student ID was not found in the system." },
        { status: 403 }
      );
    }

    if (!whitelisted.program_id) {
      return NextResponse.json(
        { error: "Your student ID has no program assigned yet. Please contact the librarian." },
        { status: 422 }
      );
    }
    programIdToSave = whitelisted.program_id;

    // The adviser must be an active adviser in the student's own program.
    if (adviserId) {
      const { data: adviserProfile } = await admin
        .from("profiles")
        .select("role, status, program_id")
        .eq("id", String(adviserId))
        .single();

      const validAdviser =
        adviserProfile?.role === "capstone_adviser" &&
        adviserProfile?.status === "active" &&
        adviserProfile?.program_id === programIdToSave;

      if (!validAdviser) {
        return NextResponse.json({ error: "Invalid adviser selected." }, { status: 400 });
      }
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
      program_id: programIdToSave,
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

    /*
     * Runs after the response is sent, so the SMTP round trip does not delay
     * registration and a mail failure can never fail an account that already exists.
     */
    if (emailConfigured()) {
      after(async () => {
        try {
          await sendWelcomeEmail({
            to: email,
            name: fullName.trim(),
            studentId: studentId.trim(),
          });
        } catch (err) {
          console.error("[register] Welcome email failed:", err.message);
        }
      });
    }
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPasswordLink } from "@/lib/passwordLink";
import { emailConfigured, sendPasswordLinkEmail } from "@/lib/email";

// POST /api/auth/forgot-password   body: { email, studentId? }
// Public. Students send their student ID too, advisers and staff send email only.
// The answer is always the same, whether or not an account matches, so this
// cannot be used to find out who is registered. All the work runs after the
// response, which also keeps the response time the same either way.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";

  if (!email.includes("@") || email.length > 254 || studentId.length > 20) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!emailConfigured()) {
    console.error("[forgot-password] GMAIL_USER / GMAIL_APP_PASSWORD not set, no email sent");
  } else {
    after(async () => {
      try {
        const admin = createAdminClient();

        const { data, error } = await admin.rpc("find_reset_target", {
          p_email: email,
          p_id_number: studentId || null,
        });
        if (error) throw error;
        const target = data?.[0];
        if (!target) return;

        const { data: allowed, error: throttleError } = await admin.rpc("allow_password_reset", {
          p_user_id: target.id,
        });
        if (throttleError) throw throttleError;
        if (!allowed) return;

        const link = await createPasswordLink(admin, { userId: target.id, email: target.email });
        await sendPasswordLinkEmail({ to: target.email, name: target.full_name, link, variant: "forgot" });
      } catch (err) {
        console.error("[forgot-password]", err.message);
      }
    });
  }

  return NextResponse.json({ ok: true });
}

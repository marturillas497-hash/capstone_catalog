import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import nodemailer from "nodemailer";

function buildEmail(name, action, appUrl) {
  const isApproved = action === "approved";

  const accentColor = isApproved ? "#FFCC00" : "#FF7A1F";
  const headingText = isApproved
    ? "Your account has been approved."
    : "Your application was not approved.";
  const bodyText = isApproved
    ? `Hi ${name}, your Capstone Library adviser account has been reviewed and approved by the administrator. You can now log in and access your adviser portal.`
    : `Hi ${name}, your Capstone Library adviser account application has been reviewed and was not approved at this time. Please contact the administrator for further information.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headingText}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#003366;border-radius:12px 12px 0 0;padding:32px 40px 28px;text-align:center;">
              <!-- Gold/orange accent strip -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="height:3px;background-color:${accentColor};border-radius:2px;"></td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${accentColor};">
                Makilala Institute of Science and Technology
              </p>
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">
                Capstone Library
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">

              <!-- Status badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:${isApproved ? "#FFFBEB" : "#FFF7ED"};border:1px solid ${accentColor};border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:${isApproved ? "#92400E" : "#9A3412"};">
                      ${isApproved ? "✓ Account Approved" : "✗ Application Not Approved"}
                    </span>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F172A;line-height:1.3;">
                ${headingText}
              </h1>

              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#475569;">
                ${bodyText}
              </p>

              ${isApproved ? `
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#003366;border-radius:8px;">
                    <a href="${appUrl}/login"
                       style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                      Log In to Your Portal →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;color:#94A3B8;">
                Or copy this link: <a href="${appUrl}/login" style="color:#003366;">${appUrl}/login</a>
              </p>
              ` : `
              <p style="margin:0;font-size:13px;color:#94A3B8;">
                If you believe this is a mistake, please reach out to the MIST library administrator directly.
              </p>
              `}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F1F5F9;border-radius:0 0 12px 12px;border:1px solid #E2E8F0;border-top:none;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6;">
                This is an automated message from the Capstone Library system.<br/>
                Bachelor of Science in Information Systems · MIST
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to, name, action) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const isApproved = action === "approved";

  const subject = isApproved
    ? "Your Capstone Library adviser account has been approved"
    : "Your Capstone Library adviser account application was not approved";

  const plainText = isApproved
    ? `Hi ${name}, your Capstone Library adviser account has been approved. Log in at ${appUrl}/login to access your adviser portal.`
    : `Hi ${name}, your Capstone Library adviser account application was not approved. Please contact the administrator for further information.`;

  await transporter.sendMail({
    from: `"Capstone Library" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text: plainText,
    html: buildEmail(name, action, appUrl),
  });
}

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

    if (email && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        await sendEmail(email, target.full_name, action);
      } catch (emailErr) {
        console.error("[approvals] Email send failed:", emailErr);
      }
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("[PATCH /api/admin/approvals/[id]]", err);
    return NextResponse.json({ error: "Failed to process application" }, { status: 500 });
  }
}
import nodemailer from "nodemailer";

/*
 * Single home for all outgoing email. Uses Gmail SMTP with GMAIL_USER,
 * GMAIL_APP_PASSWORD and NEXT_PUBLIC_APP_URL. The transport is created once
 * per server instance and reused so warm invocations skip connection setup.
 */
let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export function emailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// User supplied values (names, student IDs) are interpolated into HTML.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendMail({ to, subject, text, html }) {
  return getTransporter().sendMail({
    from: `"MIST Topic Compass" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

/*
 * Shared branded layout. `heading` and `badge.label` are plain text and get
 * escaped here. `paragraphs` and `note` are HTML, so callers escape any user
 * supplied value before passing it in.
 */
function renderEmail({ accent, badge, heading, paragraphs, cta, note }) {
  const safeHeading = escapeHtml(heading);

  const body = paragraphs
    .map((html, i) => {
      const margin = i === paragraphs.length - 1 ? "28px" : "16px";
      return `<p style="margin:0 0 ${margin};font-size:15px;line-height:1.7;color:#475569;">${html}</p>`;
    })
    .join("\n              ");

  const ctaBlock = cta
    ? `<table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#003366;border-radius:8px;">
                    <a href="${cta.url}"
                       style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                      ${escapeHtml(cta.label)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 ${note ? "24px" : "0"};font-size:12px;color:#94A3B8;">
                Or copy this link: <a href="${cta.url}" style="color:#003366;">${cta.url}</a>
              </p>`
    : "";

  const noteBlock = note
    ? `<p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">${note}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeHeading}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <tr>
            <td style="background-color:#003366;border-radius:12px 12px 0 0;padding:32px 40px 28px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="height:3px;background-color:${accent};border-radius:2px;"></td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${accent};">
                Makilala Institute of Science and Technology
              </p>
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">
                MIST Topic Compass
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:${badge.bg};border:1px solid ${accent};border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:${badge.color};">${escapeHtml(badge.label)}</span>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F172A;line-height:1.3;">
                ${safeHeading}
              </h1>

              ${body}

              ${ctaBlock}
              ${noteBlock}
            </td>
          </tr>

          <tr>
            <td style="background-color:#F1F5F9;border-radius:0 0 12px 12px;border:1px solid #E2E8F0;border-top:none;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6;">
                This is an automated message from the MIST Topic Compass system.<br/>
                Makilala Institute of Science and Technology
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

export function sendWelcomeEmail({ to, name, studentId }) {
  const appUrl = getAppUrl();

  return sendMail({
    to,
    subject: "Welcome to MIST Topic Compass",
    text:
      `Hi ${name}, your MIST Topic Compass student account is ready and linked to student ID ${studentId}. ` +
      `Log in at ${appUrl}/login to browse completed studies and run similarity scans. ` +
      `If you did not create this account, please contact the MIST library administrator.`,
    html: renderEmail({
      accent: "#FFCC00",
      badge: { label: "\u2713 Registration Complete", bg: "#FFFBEB", color: "#92400E" },
      heading: `Welcome, ${name}.`,
      paragraphs: [
        `Your student account is ready and linked to student ID <strong>${escapeHtml(studentId)}</strong>. ` +
          `You can log in now to browse completed studies in your program and run similarity scans on your proposed topic, up to 5 per day.`,
        "You can also pick your adviser from your profile page.",
      ],
      cta: { label: "Log In to MIST Topic Compass \u2192", url: `${appUrl}/login` },
      note: "If you did not create this account, please contact the MIST library administrator.",
    }),
  });
}

// action is "approved" or "rejected".
export function sendAdviserDecisionEmail({ to, name, action }) {
  const appUrl = getAppUrl();
  const approved = action === "approved";
  const safeName = escapeHtml(name);

  if (approved) {
    return sendMail({
      to,
      subject: "Your MIST Topic Compass adviser account has been approved",
      text: `Hi ${name}, your MIST Topic Compass adviser account has been approved. Log in at ${appUrl}/login to access your adviser portal.`,
      html: renderEmail({
        accent: "#FFCC00",
        badge: { label: "\u2713 Account Approved", bg: "#FFFBEB", color: "#92400E" },
        heading: "Your account has been approved.",
        paragraphs: [
          `Hi ${safeName}, your MIST Topic Compass adviser account has been reviewed and approved by the administrator. You can now log in and access your adviser portal.`,
        ],
        cta: { label: "Log In to Your Portal \u2192", url: `${appUrl}/login` },
      }),
    });
  }

  return sendMail({
    to,
    subject: "Your MIST Topic Compass adviser account application was not approved",
    text: `Hi ${name}, your MIST Topic Compass adviser account application was not approved. Please contact the administrator for further information.`,
    html: renderEmail({
      accent: "#FF7A1F",
      badge: { label: "\u2717 Application Not Approved", bg: "#FFF7ED", color: "#9A3412" },
      heading: "Your application was not approved.",
      paragraphs: [
        `Hi ${safeName}, your MIST Topic Compass adviser account application has been reviewed and was not approved at this time. Please contact the administrator for further information.`,
      ],
      note: "If you believe this is a mistake, please reach out to the MIST library administrator directly.",
    }),
  });
}

/*
 * One-time "set your password" link. Variants:
 *  forgot : the person asked for it on the forgot-password page
 *  reset  : the admin started a reset from user management
 *  invite : a new staff account created by the admin
 * The link works once and expires in 1 hour.
 */
const PASSWORD_LINK_COPY = {
  forgot: {
    subject: "Reset your MIST Topic Compass password",
    accent: "#FF7A1F",
    badge: { label: "Password Reset", bg: "#FFF7ED", color: "#9A3412" },
    heading: (name) => `Reset your password, ${name}.`,
    intro: "we received a request to reset your MIST Topic Compass password. Use the button below to sign in and choose a new one.",
    cta: "Set a New Password \u2192",
    note: "If you did not request this, you can ignore this email. Your password has not changed.",
  },
  reset: {
    subject: "Set a new MIST Topic Compass password",
    accent: "#FF7A1F",
    badge: { label: "Password Reset", bg: "#FFF7ED", color: "#9A3412" },
    heading: (name) => `Set a new password, ${name}.`,
    intro: "the library administrator started a password reset for your account. Use the button below to sign in and choose a new password.",
    cta: "Set a New Password \u2192",
    note: "If you did not expect this, please contact the MIST library administrator.",
  },
  invite: {
    subject: "Your MIST Topic Compass staff account is ready",
    accent: "#FFCC00",
    badge: { label: "\u2713 Account Created", bg: "#FFFBEB", color: "#92400E" },
    heading: (name) => `Welcome, ${name}.`,
    intro: "the library administrator created a staff account for you. Use the button below to set your password and sign in. As staff you can add abstracts to the library, edit the ones you added, and view reading analytics.",
    cta: "Set Your Password \u2192",
    note: "If you did not expect this account, please contact the MIST library administrator.",
  },
};

export function sendPasswordLinkEmail({ to, name, link, variant }) {
  const c = PASSWORD_LINK_COPY[variant];
  if (!c) throw new Error(`Unknown password email variant: ${variant}`);

  return sendMail({
    to,
    subject: c.subject,
    text:
      `Hi ${name}, ${c.intro} ` +
      `Open this link: ${link} ` +
      `It works once and expires in 1 hour. If it expires, use "Forgot password" on the login page. ${c.note}`,
    html: renderEmail({
      accent: c.accent,
      badge: c.badge,
      heading: c.heading(name),
      paragraphs: [
        `Hi ${escapeHtml(name)}, ${c.intro}`,
        "This link works once and expires in <strong>1 hour</strong>. If it expires, use <em>Forgot password</em> on the login page to get a new one.",
      ],
      cta: { label: c.cta, url: link },
      note: c.note,
    }),
  });
}

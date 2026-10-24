import { NextResponse, after } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReadablePassword } from "@/lib/passwordWords";
import { emailConfigured, sendStaffWelcomeEmail } from "@/lib/email";

// GET  /api/admin/staff  Paginated, searched, sorted list of staff accounts.
// POST /api/admin/staff  Admin creates a staff account. The starting password
//                        is generated here and returned exactly once. It is
//                        never stored or logged.
//
// Staff never self-register: there is no public route that can create this role.
// Both handlers use requireActiveUser, so a suspended admin session is refused too.

const PAGE_SIZE = 25;
const SORT_KEYS = ["name", "date"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request) {
  try {
    const auth = await requireActiveUser(["admin"]);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const sort = SORT_KEYS.includes(searchParams.get("sort")) ? searchParams.get("sort") : "date";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

    const { data, error } = await createAdminClient().rpc("admin_list_staff", {
      p_q: q || null,
      p_status: status || null,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    });
    if (error) throw error;

    const total = data.length > 0 ? parseInt(data[0].full_count, 10) : 0;
    const rows = data.map(({ full_count, ...row }) => row);

    return NextResponse.json({
      rows,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (err) {
    console.error("[GET /api/admin/staff]", err);
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireActiveUser(["admin"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim().replace(/\s+/g, " ") : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (fullName.length < 2 || fullName.length > 100) {
      return NextResponse.json({ error: "Enter the staff member's full name (2 to 100 characters)." }, { status: 400 });
    }
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const admin = createAdminClient();
    const password = generateReadablePassword();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      const duplicate =
        createErr.code === "email_exists" || /already (been )?registered/i.test(createErr.message || "");
      if (duplicate) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }
      throw createErr;
    }

    const userId = created.user.id;

    // terms_accepted_at stays null, the same as the admin account: this
    // account was created by the admin, not through the registration screen.
    const { error: profileErr } = await admin
      .from("profiles")
      .insert({ id: userId, full_name: fullName, role: "staff", status: "active" });

    if (profileErr) {
      await admin.auth.admin.deleteUser(userId);
      throw profileErr;
    }

    // After the response, so the admin does not wait on SMTP and a mail failure
    // cannot undo the account. The password is not part of the email.
    if (emailConfigured()) {
      after(async () => {
        try {
          await sendStaffWelcomeEmail({ to: email, name: fullName });
        } catch (mailErr) {
          console.error("[POST /api/admin/staff] Welcome email failed:", mailErr.message);
        }
      });
    }

    return NextResponse.json({ id: userId, fullName, email, password }, { status: 201 });
  } catch (err) {
    // The generated password is deliberately never logged.
    console.error("[POST /api/admin/staff]", err);
    return NextResponse.json({ error: "Failed to create the staff account." }, { status: 500 });
  }
}

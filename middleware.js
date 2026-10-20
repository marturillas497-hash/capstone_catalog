import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/"];

const HOME = {
  admin: "/admin",
  capstone_adviser: "/adviser",
  student: "/dashboard",
};

const STUDENT_ONLY = ["/dashboard"];
const NO_ADMIN = ["/submit"];
const ADVISER_ONLY = ["/adviser"];
const ADMIN_ONLY = ["/admin"];
const PROFILE_ALLOWED_ROLES = ["student", "capstone_adviser"];

// Identity headers this middleware sets for Server Components. Any copy sent
// by the client is dropped up front, so a request that returns early (public
// paths) can never carry a spoofed value through to a page.
const IDENTITY_HEADERS = [
  "x-user-id",
  "x-user-role",
  "x-user-status",
  "x-user-name",
  "x-user-email",
];

function toHome(role, request) {
  const path = HOME[role] ?? "/login";
  return NextResponse.redirect(new URL(path, request.url));
}

function toLogin(request, params = "") {
  return NextResponse.redirect(new URL(`/login${params}`, request.url));
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  /*
    requestHeaders carries the x-user-* values (set near the end of this
    function) down to Server Components via next/headers, so pages can skip
    re-querying profiles. pendingCookies preserves any Supabase session
    refresh cookies so rebuilding the response later doesn't drop them.
  */
  let requestHeaders = new Headers(request.headers);
  for (const name of IDENTITY_HEADERS) requestHeaders.delete(name);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  let pendingCookies = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          pendingCookies = cookiesToSet;
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public paths — redirect to role home if already logged in, else pass through
  if (PUBLIC_PATHS.includes(pathname)) {
    if (!user) return pathname === "/" ? toLogin(request) : response;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (!profile) return toLogin(request);
    if (profile.role === "capstone_adviser" && profile.status === "pending") return response;
    if (profile.status === "rejected" || profile.status === "suspended") return response;

    return toHome(profile.role, request);
  }

  // No session — send to login
  if (!user) return toLogin(request);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile) return toLogin(request);

  const { role, status, full_name } = profile;

  // Pending adviser — block and send back to login
  if (role === "capstone_adviser" && status === "pending") {
    return toLogin(request, "?status=pending");
  }

  // Rejected or suspended — block
  if (status === "rejected" || status === "suspended") {
    return toLogin(request, `?error=${status}`);
  }

  // Admin-only routes
  if (ADMIN_ONLY.some((p) => pathname.startsWith(p)) && role !== "admin") {
    return toHome(role, request);
  }

  // Adviser-only routes
  if (ADVISER_ONLY.some((p) => pathname.startsWith(p)) && role !== "capstone_adviser") {
    return toHome(role, request);
  }

  // Student-only routes
  if (STUDENT_ONLY.some((p) => pathname.startsWith(p)) && role !== "student") {
    return toHome(role, request);
  }

  // Profile — students and advisers only
  if (pathname.startsWith("/profile") && !PROFILE_ALLOWED_ROLES.includes(role)) {
    return toHome(role, request);
  }

  // Routes admins cannot access
  if (NO_ADMIN.some((p) => pathname.startsWith(p)) && role === "admin") {
    return toHome(role, request);
  }

  /*
    Forward verified identity to the page. .set() always overwrites, so a
    client-supplied header of the same name can't spoof this. full_name and
    email are encodeURIComponent-escaped since header values must be
    ASCII-safe.
  */
  requestHeaders.set("x-user-id", user.id);
  requestHeaders.set("x-user-role", role);
  requestHeaders.set("x-user-status", status);
  requestHeaders.set("x-user-name", encodeURIComponent(full_name ?? ""));
  requestHeaders.set("x-user-email", encodeURIComponent(user.email ?? ""));

  response = NextResponse.next({ request: { headers: requestHeaders } });
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
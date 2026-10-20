"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  BookOpen,
  ScanLine,
  User,
  Users,
  Clock,
  Plus,
  CheckCircle,
  BarChart3,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import ChangePasswordModal from "./ChangePasswordModal";

// `group` controls sidebar sectioning (desktop only). `chip` controls the
// icon treatment: "gold"/"orange" render a filled color chip (reused from
// the existing bg-gold/bg-orange icon-box convention in Section 21 of the
// PRD, e.g. Browse Library / Manage Whitelist), everything else renders as
// a plain white icon since a navy chip would disappear against the navy
// sidebar background.
const NAV_LINKS = {
  student: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
    { href: "/dashboard/scans", label: "My Scans", icon: Clock, group: "Overview" },
    { href: "/library", label: "Library", icon: BookOpen, group: "Library", chip: "gold" },
    { href: "/submit", label: "New Scan", icon: ScanLine, group: "Library", chip: "orange" },
    { href: "/profile", label: "Profile", icon: User, group: "Account" },
  ],
  capstone_adviser: [
    { href: "/adviser", label: "My Students", icon: Users, group: "Overview" },
    { href: "/adviser/scans", label: "My Scans", icon: Clock, group: "Overview" },
    { href: "/library", label: "Library", icon: BookOpen, group: "Library", chip: "gold" },
    { href: "/submit", label: "New Scan", icon: ScanLine, group: "Library", chip: "orange" },
    { href: "/profile", label: "Profile", icon: User, group: "Account" },
  ],
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
    { href: "/library", label: "Library", icon: BookOpen, group: "Library", chip: "gold" },
    { href: "/admin/archive", label: "Add Abstract", icon: Plus, group: "Library" },
    { href: "/admin/approvals", label: "Approvals", icon: CheckCircle, group: "Governance" },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3, group: "Governance" },
    { href: "/admin/whitelist", label: "Whitelist", icon: ShieldCheck, group: "Governance", chip: "gold" },
    { href: "/admin/users", label: "User Management", icon: UserCog, group: "Governance" },
  ],
};

// Groups links into sections, preserving first-appearance order, so each
// role only ever shows the sections it actually has (e.g. only admin gets
// "Governance").
function groupLinks(links) {
  const groups = [];
  for (const link of links) {
    let group = groups.find((g) => g.label === link.group);
    if (!group) {
      group = { label: link.group, items: [] };
      groups.push(group);
    }
    group.items.push(link);
  }
  return groups;
}

const ROLE_LABELS = {
  student: "Student",
  capstone_adviser: "Capstone Adviser",
  admin: "Administrator",
};

// Name and role chip for the top of the desktop sidebar footer. Students and
// advisers link to /profile; the admin has no profile page, so it renders as
// plain text.
function UserChip({ role, fullName, initials }) {
  const body = (
    <>
      <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-navy leading-none">{initials}</span>
      </div>
      <div className="min-w-0 leading-tight text-left">
        <p className="text-[13px] font-semibold text-white truncate">{fullName}</p>
        <p className="text-[11px] text-white/50">{ROLE_LABELS[role]}</p>
      </div>
    </>
  );
  const base = "flex items-center gap-2.5 rounded-lg px-2 py-2 mb-2";
  if (role === "admin") return <div className={base}>{body}</div>;
  return (
    <a href="/profile" className={`${base} hover:bg-white/10 transition`}>
      {body}
    </a>
  );
}

export default function Navbar({ role, fullName }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const links = NAV_LINKS[role] ?? [];
  const groups = groupLinks(links);
  const initials = fullName?.split(" ").map((n) => n[0]).slice(0, 2).join("");

  function openSignOutModal() {
    setMenuOpen(false);
    setSignOutModalOpen(true);
  }

  function closeSignOutModal() {
    if (signingOut) return;
    setSignOutModalOpen(false);
  }

  async function confirmSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href) {
    if (href === "/adviser") {
      return pathname === href || pathname.startsWith("/adviser/students");
    }
    if (href === "/dashboard" || href === "/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  function renderIcon(link, active) {
    const Icon = link.icon;
    if (link.chip === "gold") {
      return <Icon className="w-[15px] h-[15px] text-navy" strokeWidth={1.9} />;
    }
    if (link.chip === "orange") {
      return <Icon className="w-[15px] h-[15px] text-white" strokeWidth={1.9} />;
    }
    return (
      <Icon
        className={`w-[15px] h-[15px] ${active ? "text-white" : "text-white/50"}`}
        strokeWidth={1.9}
      />
    );
  }

  return (
    <>
      {/* Mobile top bar — unchanged from the previous navbar, only visible below md */}
      <nav className="md:hidden bg-navy sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <a href="/" className="flex items-center gap-2.5 shrink-0">
              <Image
                src="/mist-logo.png"
                alt="MIST"
                width={28}
                height={28}
                className="rounded-full"
              />
              <span className="font-display text-lg text-white leading-none">
                Capstone Library
              </span>
            </a>

            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <X className="w-5 h-5" strokeWidth={1.75} />
              ) : (
                <Menu className="w-5 h-5" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-navy px-4 py-3 space-y-1">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-white/10 text-white"
                      : link.label === "New Scan"
                      ? "text-orange hover:bg-white/5"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 ${
                      link.chip === "gold" ? "bg-gold" : link.chip === "orange" ? "bg-orange" : ""
                    }`}
                  >
                    {renderIcon(link, active)}
                  </span>
                  {link.label}
                </a>
              );
            })}

            <div className="pt-2 border-t border-white/10 mt-2">
              <div className="flex items-center gap-2.5 px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-navy leading-none">{initials}</span>
                </div>
                <p className="text-xs text-white/60 truncate">{fullName}</p>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setChangePasswordOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                Change Password
              </button>
              <button
                onClick={openSignOutModal}
                className="w-full flex items-center justify-center gap-2 mt-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.75} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Desktop sidebar — visible at md and up */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 md:h-screen md:sticky md:top-0 bg-navy">
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Image
              src="/mist-logo.png"
              alt="MIST"
              width={30}
              height={30}
              className="rounded-full border-2 border-gold"
            />
            <div className="w-px h-5 bg-white/20" />
            <Image
              src="/is-logo.png"
              alt="Information Systems"
              width={30}
              height={30}
              className="rounded-full border-2 border-orange"
            />
          </div>
          <p className="font-display text-white text-[15px] leading-tight">Capstone Library</p>
          <p className="text-orange-light text-[11px] font-semibold mt-0.5">MIST · BSIS</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold text-white/35 px-3 pt-3 pb-1.5 first:pt-1">
                {group.label}
              </p>
              {group.items.map((link) => {
                const active = isActive(link.href);
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2.5 px-3 py-2 mb-0.5 rounded-lg text-[13.5px] font-medium border-l-[3px] transition ${
                      active
                        ? "bg-white/10 text-white font-semibold border-orange"
                        : link.label === "New Scan"
                        ? "text-orange-light hover:text-orange hover:bg-white/5 border-transparent"
                        : "text-white/60 hover:text-white hover:bg-white/5 border-transparent"
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 ${
                        link.chip === "gold" ? "bg-gold" : link.chip === "orange" ? "bg-orange" : ""
                      }`}
                    >
                      {renderIcon(link, active)}
                    </span>
                    {link.label}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          {fullName && <UserChip role={role} fullName={fullName} initials={initials} />}
          <button
            onClick={() => setChangePasswordOpen(true)}
            className="block w-full text-left text-[12.5px] font-medium text-white/50 hover:text-white transition py-1"
          >
            Change Password
          </button>
          <button
            onClick={openSignOutModal}
            className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Sign out confirmation modal — shared by both mobile and desktop nav */}
      {signOutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={closeSignOutModal}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-modal-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-500" strokeWidth={1.75} />
              </div>
              <h2 className="font-display text-xl text-navy">Sign Out</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to sign out of Capstone Library?
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmSignOut}
                disabled={signingOut}
                className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signingOut ? "Signing out…" : "Sign Out"}
              </button>
              <button
                onClick={closeSignOutModal}
                disabled={signingOut}
                className="flex-1 bg-slate-100 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
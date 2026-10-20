"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import { UserCog, Save, Lock, Loader2, Mail, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { YEAR_LEVELS, SECTIONS } from "@/lib/constants";

export default function ProfileClient({ profile }) {
  const [meta, setMeta] = useState(null);
  const [advisers, setAdvisers] = useState([]);
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");
  const [adviserId, setAdviserId] = useState("");
  const [assignedCount, setAssignedCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      // Advisers have no student_metadata-equivalent row. Instead, show
      // a count of their assigned students, reusing the same route the
      // "My Students" page already calls.
      if (profile.role === "capstone_adviser") {
        const res = await fetch("/api/adviser/students");
        const data = await res.json();
        setAssignedCount(Array.isArray(data.students) ? data.students.length : 0);
        setLoading(false);
        return;
      }

      const supabase = createClient();

      const { data: m } = await supabase
        .from("student_metadata")
        .select("id_number, year_level, section, adviser_id")
        .eq("profile_id", profile.id)
        .single();

      const { data: adviserList } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "capstone_adviser")
        .eq("status", "active")
        .order("full_name");

      setMeta(m);
      setYearLevel(m?.year_level ?? "");
      setSection(m?.section ?? "");
      setAdviserId(m?.adviser_id ?? "");
      setAdvisers(adviserList ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const supabase = createClient();
    const prevAdviserId = meta?.adviser_id ?? null;
    const newAdviserId = adviserId || null;

    const { error: metaError } = await supabase
      .from("student_metadata")
      .update({
        year_level: yearLevel || null,
        section: section || null,
        adviser_id: newAdviserId,
      })
      .eq("profile_id", profile.id);

    if (metaError) {
      setError("Failed to save profile. Please try again.");
      setSaving(false);
      return;
    }

    // Retroactively update adviser_id on all reports if adviser changed
    if (newAdviserId !== prevAdviserId) {
      await fetch(`/api/students/${profile.id}/reports/adviser`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adviserId: newAdviserId }),
      });
    }

    setSuccess(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background md:flex">
        <Navbar role={profile.role} fullName={profile.full_name} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-600">Loading profile…</p>
        </main>
      </div>
    );
  }

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-background shadow-neo-inset border-none text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition";

  const readonlyClass =
    "w-full px-3 py-2 rounded-lg bg-background shadow-neo-inset border-none text-sm text-slate-500 cursor-not-allowed";

  // Advisers have no editable fields today — no adviser-equivalent of
  // student_metadata exists, so this is a read-only summary rather than a
  // form. If that changes (e.g. a contact field is added), branch this into
  // its own component the way the student form already is.
  if (profile.role === "capstone_adviser") {
    return (
      <div className="min-h-screen bg-background md:flex">
        <Navbar role={profile.role} fullName={profile.full_name} />

        <main className="flex-1 max-w-xl mx-auto px-4 py-8">
          <PageHeader
            variant="stats"
            title="My Profile"
            subtitle="Your account details on file with the institution."
            icon={UserCog}
            iconBg="bg-navy"
          />

          <div className="bg-background shadow-neo neo-transition rounded-2xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Full name
              </label>
              <div className={readonlyClass}>{profile.full_name}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                Email
              </label>
              <div className={readonlyClass}>{profile.email}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Role
                </label>
                <div className={readonlyClass}>Capstone Adviser</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Status
                </label>
                <div className={readonlyClass + " capitalize"}>{profile.status}</div>
              </div>
            </div>

            <hr className="border-slate-100" />

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                Assigned Students
              </label>
              <div className={readonlyClass}>
                {assignedCount === null ? "…" : assignedCount}
              </div>
              <a
                href="/adviser"
                className="inline-block mt-2 text-xs font-medium text-orange hover:underline"
              >
                View my students →
              </a>
            </div>

            <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              Your name and account status are managed by the administrator.
              To change your password, use Change Password in the sidebar.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />

      <main className="flex-1 max-w-xl mx-auto px-4 py-8">
        <PageHeader
          variant="stats"
          title="My Profile"
          subtitle="Update your year level, section, and assigned adviser."
          icon={UserCog}
          iconBg="bg-navy"
        />

        <div className="bg-background shadow-neo neo-transition rounded-2xl p-6">
          <form onSubmit={handleSave} className="space-y-5">

            {/* Read-only fields */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Full name
              </label>
              <div className={readonlyClass}>{profile.full_name}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                Student ID
              </label>
              <div className={readonlyClass}>{meta?.id_number}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Role
                </label>
                <div className={readonlyClass}>Student</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Status
                </label>
                <div className={readonlyClass + " capitalize"}>{profile.status}</div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Year Level
                </label>
                <select
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Not set</option>
                  {YEAR_LEVELS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Section
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Not set</option>
                  {SECTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Capstone Adviser
              </label>
              <select
                value={adviserId}
                onChange={(e) => setAdviserId(e.target.value)}
                className={inputClass}
              >
                <option value="">No adviser assigned</option>
                {advisers.map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Changing your adviser updates visibility on all your past reports.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && (
              <p className="text-sm text-green-600">Profile saved successfully.</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-navy-light transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" strokeWidth={1.75} />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
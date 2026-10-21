"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import AbstractForm from "@/components/shared/AbstractForm";
import { Plus, Pencil, BookOpen } from "lucide-react";

/*
 * The "add an abstract" screen for admin (/admin/archive) and staff
 * (/staff/add). Staff see only their own recent additions, but the "last
 * accession ID" hint is library wide, since accession numbers come from the
 * physical bound copies and are shared by everyone who encodes.
 */
export default function AddAbstractView({ defaultRole, editBase, mineOnly = false, subtitle }) {
  const supabase = createClient();
  const [profile, setProfile] = useState({ role: defaultRole, fullName: "" });
  const [lastAccession, setLastAccession] = useState(null);
  const [recent, setRecent] = useState([]);
  const userIdRef = useRef(null);

  async function refresh() {
    let recentQuery = supabase
      .from("abstracts")
      .select("id, title, accession_id, year, authors")
      .order("created_at", { ascending: false })
      .limit(5);
    if (mineOnly) recentQuery = recentQuery.eq("added_by", userIdRef.current);

    const [{ data: recentRows }, { data: latest }] = await Promise.all([
      recentQuery,
      mineOnly
        ? supabase.from("abstracts").select("accession_id").order("created_at", { ascending: false }).limit(1)
        : Promise.resolve({ data: null }),
    ]);

    setRecent(recentRows ?? []);
    setLastAccession((mineOnly ? latest?.[0] : recentRows?.[0])?.accession_id || null);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;
      const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
      if (data) setProfile({ role: data.role, fullName: data.full_name });
      await refresh();
    }
    init();
  }, []);

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          title={mineOnly ? "Add Abstract" : "Add to Archive"}
          subtitle={subtitle}
          icon={Plus}
          iconBg="bg-navy"
        />

        {lastAccession && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 mb-6">
            Last accession ID on record, <span className="font-mono font-semibold">{lastAccession}</span>
          </div>
        )}

        <AbstractForm mode="add" onSaved={refresh} />

        {recent.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gold-dark" strokeWidth={1.75} />
              {mineOnly ? "Your Recent Additions" : "Recently Added"}
            </h2>
            <div className="space-y-2">
              {recent.map((a) => (
                <Link
                  key={a.id}
                  href={`${editBase}/${a.id}`}
                  className="flex items-center justify-between bg-background shadow-neo hover:shadow-neo-hover hover:-translate-y-1 active:shadow-neo-inset active:translate-y-0 neo-transition rounded-lg px-4 py-3 group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate group-hover:text-navy transition-colors">
                      {a.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[a.accession_id, a.year, a.authors].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-navy shrink-0 ml-4">
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Edit
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

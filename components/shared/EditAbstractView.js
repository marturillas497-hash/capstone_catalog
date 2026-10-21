"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import AbstractForm from "@/components/shared/AbstractForm";
import { ArrowLeft, Pencil } from "lucide-react";

/*
 * The edit screen for admin (/admin/archive/[id]) and staff
 * (/staff/abstracts/[id]). With ownOnly, a staff member who opens an abstract
 * they did not add sees a notice instead of the form. The API enforces the
 * same rule, so this only saves them a failed save.
 */
export default function EditAbstractView({ id, defaultRole, backHref, backLabel, ownOnly = false }) {
  const supabase = createClient();
  const [profile, setProfile] = useState({ role: defaultRole, fullName: "" });
  const [initial, setInitial] = useState(null);
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
        if (data) setProfile({ role: data.role, fullName: data.full_name });
      }

      const { data, error } = await supabase
        .from("abstracts")
        .select("id, title, abstract_text, authors, year, accession_id, keywords, added_by")
        .eq("id", id)
        .single();

      if (error || !data) {
        setProblem("Abstract not found.");
      } else if (ownOnly && data.added_by !== user?.id) {
        setProblem("You can only edit abstracts you added.");
      } else {
        setInitial({
          title: data.title || "",
          abstract_text: data.abstract_text || "",
          authors: data.authors || "",
          year: data.year ? String(data.year) : "",
          accession_id: data.accession_id || "",
          keywords: data.keywords || [],
        });
      }
      setLoading(false);
    }
    init();
  }, [id]);

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-100 rounded w-64" />
            <div className="bg-background shadow-neo neo-transition rounded-xl p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-foreground mb-6 transition"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              {backLabel}
            </Link>

            <PageHeader
              variant="stats"
              title="Edit Abstract"
              subtitle="Changes will regenerate the embedding from the updated title and abstract text."
              icon={Pencil}
              iconBg="bg-navy"
            />

            {problem ? (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{problem}</div>
            ) : (
              <AbstractForm mode="edit" abstractId={id} initialValues={initial} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

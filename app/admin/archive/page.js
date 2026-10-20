"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import { useEmbedding } from "@/components/shared/EmbeddingProvider";
import Link from "next/link";
import { Plus, Pencil, BookOpen } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import TagInput, { fetchAllTags } from "@/components/shared/TagInput";

export default function AdminArchivePage() {
  const supabase = createClient();
  const { getEmbedding, isReady, isLoading: embeddingLoading } = useEmbedding();

  const [form, setForm] = useState({
    title: "",
    abstract_text: "",
    authors: "",
    year: "",
    accession_id: "",
    keywords: [],
  });
  const [lastAccession, setLastAccession] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [recentAbstracts, setRecentAbstracts] = useState([]);
  const [profile, setProfile] = useState({ role: "admin", fullName: "" });

  // Full distinct keyword list, powers the TagInput autocomplete dropdown
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .single();
        if (data) setProfile({ role: data.role, fullName: data.full_name });
      }
      await fetchRecent();
      setAllTags(await fetchAllTags(supabase));
    }
    init();
  }, []);

  async function fetchRecent() {
    const { data } = await supabase
      .from("abstracts")
      .select("id, title, accession_id, year, authors")
      .order("created_at", { ascending: false })
      .limit(5);
    if (data && data.length > 0) {
      setRecentAbstracts(data);
      setLastAccession(data[0].accession_id || null);
    }
  }

  // Pulls the full distinct keyword set across the library to power the autocomplete dropdown
  // (fetchAllTags itself now lives in components/shared/TagInput.js)

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.abstract_text.trim()) {
      setError("Title and abstract text are required.");
      return;
    }
    if (!isReady) {
      setError("Embedding model is still loading. Please wait a moment and try again.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const combined = `${form.title.trim()} ${form.abstract_text.trim()}`;
      const embedding = await getEmbedding(combined);

      const res = await fetch("/api/admin/abstracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          abstract_text: form.abstract_text.trim(),
          authors: form.authors.trim(),
          year: form.year ? parseInt(form.year) : null,
          accession_id: form.accession_id.trim() || null,
          keywords: form.keywords,
          embedding,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add abstract");

      setSuccess(true);
      setForm({ title: "", abstract_text: "", authors: "", year: "", accession_id: "", keywords: [] });
      await fetchRecent();
      setAllTags(await fetchAllTags(supabase));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          title="Add to Archive"
          subtitle="Add a completed BSIS capstone study to the institutional library."
          icon={Plus}
          iconBg="bg-navy"
        />

        {lastAccession && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 mb-6">
            Last accession ID on record, <span className="font-mono font-semibold">{lastAccession}</span>
          </div>
        )}

        {embeddingLoading && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
            Embedding model is loading. The form is ready, but submission will wait until the model is ready.
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 mb-6">
            Abstract added successfully.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-background shadow-neo neo-transition rounded-xl p-6 space-y-5 mb-10">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Capstone Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Full capstone project title"
              className="w-full bg-background shadow-neo-inset border-none rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Accession ID</label>
              <input
                name="accession_id"
                value={form.accession_id}
                onChange={handleChange}
                placeholder="e.g. BSIS-042"
                className="w-full bg-background shadow-neo-inset border-none rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Year Published</label>
              <input
                name="year"
                type="number"
                value={form.year}
                onChange={handleChange}
                placeholder="e.g. 2024"
                min="2000"
                max={new Date().getFullYear()}
                className="w-full bg-background shadow-neo-inset border-none rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Authors</label>
              <input
                name="authors"
                value={form.authors}
                onChange={handleChange}
                required
                placeholder="Comma-separated names"
                className="w-full bg-background shadow-neo-inset border-none rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Abstract Text <span className="text-red-500">*</span>
            </label>
            <textarea
              name="abstract_text"
              value={form.abstract_text}
              onChange={handleChange}
              placeholder="Paste the full abstract here..."
              rows={8}
              className="w-full bg-background shadow-neo-inset border-none rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Keywords</label>
            <TagInput
              tags={form.keywords}
              onChange={(keywords) => setForm((f) => ({ ...f, keywords }))}
              allTags={allTags}
              variant="page"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Press Enter to add a keyword. Existing keywords will autocomplete as you type.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !isReady}
              className="bg-navy text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Generating embedding..." : !isReady ? "Model loading..." : "Add to Archive"}
            </button>
          </div>
        </form>

        {recentAbstracts.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gold-dark" strokeWidth={1.75} />
              Recently Added
            </h2>
            <div className="space-y-2">
              {recentAbstracts.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/archive/${a.id}`}
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
"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import { useEmbedding } from "@/components/shared/EmbeddingProvider";
import Link from "next/link";
import { ArrowLeft, Pencil, Save, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import TagInput, { fetchAllTags } from "@/components/shared/TagInput";

export default function EditAbstractPage({ params }) {
  const { id } = use(params);
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
  const [loadingAbstract, setLoadingAbstract] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState({ role: "admin", fullName: "" });

  // Full distinct keyword list, powers the TagInput autocomplete dropdown
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .single();
        if (profileData) setProfile({ role: profileData.role, fullName: profileData.full_name });
      }

      const { data, error } = await supabase
        .from("abstracts")
        .select("id, title, abstract_text, authors, year, accession_id, keywords")
        .eq("id", id)
        .single();

      if (error || !data) {
        setError("Abstract not found.");
        setLoadingAbstract(false);
        return;
      }

      setForm({
        title: data.title || "",
        abstract_text: data.abstract_text || "",
        authors: data.authors || "",
        year: data.year ? String(data.year) : "",
        accession_id: data.accession_id || "",
        keywords: data.keywords || [],
      });
      setLoadingAbstract(false);

      setAllTags(await fetchAllTags(supabase));
    }
    init();
  }, [id]);

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

      const res = await fetch(`/api/admin/abstracts/${id}`, {
        method: "PATCH",
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
      if (!res.ok) throw new Error(json.error || "Failed to update abstract");

      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingAbstract) {
    return (
      <div className="min-h-screen bg-background md:flex">
        <Navbar role={profile.role} fullName={profile.fullName} />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-100 rounded w-64" />
            <div className="bg-background shadow-neo neo-transition rounded-xl p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10">
        <Link
          href="/admin/archive"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-foreground mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          Back to Archive
        </Link>

        <PageHeader
          variant="stats"
          title="Edit Abstract"
          subtitle="Changes will regenerate the embedding from the updated title and abstract text."
          icon={Pencil}
          iconBg="bg-navy"
        />

        {embeddingLoading && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
            Embedding model is loading. You can edit fields now, but saving will wait until the model is ready.
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 mb-6">
            Abstract updated successfully. The embedding has been regenerated.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-background shadow-neo neo-transition rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Capstone Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
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
              rows={10}
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

          <div className="flex justify-between items-center pt-2">
            <p className="text-xs text-slate-400">Abstract deletion is not permitted.</p>
            <button
              type="submit"
              disabled={submitting || !isReady}
              className="inline-flex items-center gap-2 bg-navy text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                  Saving...
                </>
              ) : !isReady ? (
                "Model loading..."
              ) : (
                <>
                  <Save className="w-4 h-4" strokeWidth={1.75} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
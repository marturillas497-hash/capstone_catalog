"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEmbedding } from "@/components/shared/EmbeddingProvider";
import TagInput, { fetchAllTags } from "@/components/shared/TagInput";
import { Save, Loader2 } from "lucide-react";

/*
 * The abstract form, shared by the admin archive pages and the staff pages.
 * mode="add" posts a new abstract and resets. mode="edit" saves changes to
 * abstractId, with initialValues pre-filled. The embedding is regenerated
 * from the title and abstract text on every save.
 */

const EMPTY = { title: "", abstract_text: "", authors: "", year: "", accession_id: "", keywords: [] };

const inputClass =
  "w-full bg-background shadow-neo-inset border-none rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition";

export default function AbstractForm({ mode = "add", abstractId, initialValues, onSaved }) {
  const supabase = createClient();
  const { getEmbedding, isReady, isLoading: embeddingLoading } = useEmbedding();
  const isEdit = mode === "edit";

  const [form, setForm] = useState(initialValues ?? EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  // Full distinct keyword list, powers the TagInput autocomplete dropdown.
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    fetchAllTags(supabase).then(setAllTags);
  }, []);

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
      const embedding = await getEmbedding(`${form.title.trim()} ${form.abstract_text.trim()}`);

      const res = await fetch(isEdit ? `/api/admin/abstracts/${abstractId}` : "/api/admin/abstracts", {
        method: isEdit ? "PATCH" : "POST",
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
      if (!res.ok) throw new Error(json.error || (isEdit ? "Failed to update abstract" : "Failed to add abstract"));

      setSuccess(true);
      if (isEdit) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setForm(EMPTY);
        setAllTags(await fetchAllTags(supabase));
      }
      onSaved?.(json.abstract);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {embeddingLoading && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
          {isEdit
            ? "Embedding model is loading. You can edit fields now, but saving will wait until the model is ready."
            : "Embedding model is loading. The form is ready, but submission will wait until the model is ready."}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 mb-6">
          {isEdit ? "Abstract updated successfully. The embedding has been regenerated." : "Abstract added successfully."}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-6">{error}</div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`bg-background shadow-neo neo-transition rounded-xl p-6 space-y-5 ${isEdit ? "" : "mb-10"}`}
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Capstone Title <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder={isEdit ? undefined : "Full capstone project title"}
            className={inputClass}
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
              placeholder={isEdit ? undefined : "e.g. BSIS-042"}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Year Published</label>
            <input
              name="year"
              type="number"
              value={form.year}
              onChange={handleChange}
              placeholder={isEdit ? undefined : "e.g. 2024"}
              min="2000"
              max={new Date().getFullYear()}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Authors</label>
            <input
              name="authors"
              value={form.authors}
              onChange={handleChange}
              required
              placeholder={isEdit ? undefined : "Comma-separated names"}
              className={inputClass}
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
            placeholder={isEdit ? undefined : "Paste the full abstract here..."}
            rows={isEdit ? 10 : 8}
            className={`${inputClass} resize-none`}
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

        <div className={isEdit ? "flex justify-between items-center pt-2" : "flex justify-end"}>
          {isEdit && <p className="text-xs text-slate-400">Abstract deletion is not permitted.</p>}
          <button
            type="submit"
            disabled={submitting || !isReady}
            className="inline-flex items-center gap-2 bg-navy text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              isEdit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                  Saving...
                </>
              ) : (
                "Generating embedding..."
              )
            ) : !isReady ? (
              "Model loading..."
            ) : isEdit ? (
              <>
                <Save className="w-4 h-4" strokeWidth={1.75} />
                Save Changes
              </>
            ) : (
              "Add to Archive"
            )}
          </button>
        </div>
      </form>
    </>
  );
}

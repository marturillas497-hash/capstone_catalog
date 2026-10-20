"use client";

import { useState, useEffect, useRef } from "react";
import { useEmbedding } from "@/components/shared/EmbeddingProvider";
import { X, Pencil, Save, Loader2 } from "lucide-react";
import TagInput from "@/components/shared/TagInput";

const VIEW_TRACK_DELAY_MS = 5000;

export default function AbstractModal({
  abstract,
  isOpen,
  onClose,
  showAccessionNote = false,
  isAdmin = false,
  onUpdated,
  trackView = false,
  allTags = [],
}) {
  const { getEmbedding, isReady } = useEmbedding();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({});
  const viewTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen && trackView && abstract?.id) {
      viewTimerRef.current = setTimeout(() => {
        fetch(`/api/abstracts/${abstract.id}/view`, { method: "POST" }).catch(() => {});
      }, VIEW_TRACK_DELAY_MS);
    }
    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, abstract?.id]);

  if (!isOpen || !abstract) return null;

  function openEdit() {
    setForm({
      title: abstract.title ?? "",
      abstract_text: abstract.abstract_text ?? "",
      authors: abstract.authors ?? "",
      year: abstract.year ?? "",
      accession_id: abstract.accession_id ?? "",
      keywords: abstract.keywords ?? [],
    });
    setSaveError("");
    setEditing(true);
  }

  function closeEdit() {
    setEditing(false);
    setSaveError("");
  }

  async function handleSave() {
    if (!isReady) {
      setSaveError("Embedding model not ready. Please wait and try again.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const combined = `${form.title.trim()} ${form.abstract_text.trim()}`;
      const embedding = await getEmbedding(combined);

      const res = await fetch(`/api/admin/abstracts/${abstract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          year: form.year ? parseInt(form.year) : null,
          keywords: form.keywords || [],
          embedding,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? "Failed to save.");
        setSaving(false);
        return;
      }

      const data = await res.json();
      onUpdated?.(data.abstract ?? { ...abstract, ...form });
      setEditing(false);
      onClose?.();
    } catch {
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={editing ? undefined : onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-modal-in">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-sans font-semibold text-xl text-navy leading-snug">
                {editing ? "Edit Abstract" : abstract.title}
              </h2>
              {!editing && (
                <p className="text-sm text-slate-600 mt-1">
                  {abstract.authors && abstract.authors}
                  {abstract.year && ` · ${abstract.year}`}
                  {abstract.accession_id && (
                    <span className="ml-2 font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {abstract.accession_id}
                    </span>
                  )}
                </p>
              )}
            </div>
            <button
              onClick={editing ? closeEdit : onClose}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-foreground hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Abstract Text</label>
                <textarea
                  value={form.abstract_text}
                  onChange={(e) => setForm((f) => ({ ...f, abstract_text: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Authors</label>
                  <input
                    value={form.authors}
                    onChange={(e) => setForm((f) => ({ ...f, authors: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Year</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Accession ID</label>
                <input
                  value={form.accession_id}
                  onChange={(e) => setForm((f) => ({ ...f, accession_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Keywords</label>
                <TagInput
                  tags={form.keywords || []}
                  onChange={(keywords) => setForm((f) => ({ ...f, keywords }))}
                  allTags={allTags}
                  variant="modal"
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {abstract.abstract_text}
              </p>

              {abstract.keywords?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {abstract.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="text-xs bg-navy/5 text-navy px-2.5 py-1 rounded-full"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {showAccessionNote && abstract.accession_id && (
                <div className="mt-5 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-700">
                    To request the physical manuscript, provide the accession ID{" "}
                    <span className="font-mono font-semibold">{abstract.accession_id}</span>{" "}
                    to the librarian. Borrowing is not permitted; manuscripts are for on-site reading only.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving || !isReady}
                className="flex-1 flex items-center justify-center gap-2 bg-navy text-white text-sm font-medium py-2 rounded-lg hover:bg-navy/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" strokeWidth={1.75} />
                )}
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={closeEdit}
                className="flex-1 bg-slate-100 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {isAdmin && (
                <button
                  onClick={openEdit}
                  className="flex-1 flex items-center justify-center gap-2 bg-navy text-white text-sm font-medium py-2 rounded-lg hover:bg-navy/90 transition"
                >
                  <Pencil className="w-4 h-4" strokeWidth={1.75} />
                  Edit Abstract
                </button>
              )}
              <button
                onClick={onClose}
                className={`${isAdmin ? "flex-1" : "w-full"} bg-slate-100 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-200 transition`}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
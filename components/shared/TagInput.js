"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";

const VARIANTS = {
  page: {
    container:
      "flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-navy/30",
    input:
      "flex-1 min-w-[120px] text-sm text-slate-700 bg-transparent focus:outline-none placeholder:text-slate-400 py-0.5",
    dropdown:
      "absolute z-10 mt-1 w-full bg-background rounded-lg shadow-neo neo-transition max-h-48 overflow-y-auto",
  },
  modal: {
    container:
      "flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-navy/20 focus-within:border-navy transition",
    input:
      "flex-1 min-w-[120px] text-sm text-foreground bg-transparent focus:outline-none placeholder:text-slate-400 py-0.5",
    dropdown:
      "absolute z-10 mt-1 w-full bg-background rounded-lg shadow-neo neo-transition max-h-40 overflow-y-auto",
  },
};

/**
 * Shared keyword/tag pill input with autocomplete. Single source for what
 * used to be three identical copies of this input and its interaction
 * logic, in app/admin/archive/page.js (add form), app/admin/archive/[id]/page.js
 * (edit form), and components/shared/AbstractModal.js (inline edit view).
 *
 * Props:
 *  - tags: string[], the currently selected tags for this abstract
 *  - onChange: (string[]) => void, called with the updated tags array
 *  - allTags: string[], the full distinct keyword list across the library,
 *      used to power the autocomplete dropdown. Callers source this
 *      differently (a fresh query, or derived from data already in memory
 *      on /library), so it stays a prop rather than being fetched inside
 *      this component.
 *  - variant: "page" (default, plain white background, the two /admin/archive
 *      forms) or "modal" (bg-slate-50 with a navy focus border and a shorter
 *      dropdown, matches AbstractModal's other fields)
 *  - placeholder: shown only while no tags are selected yet
 */
export default function TagInput({
  tags,
  onChange,
  allTags = [],
  variant = "page",
  placeholder = "Type a keyword, press Enter…",
}) {
  const styles = VARIANTS[variant] ?? VARIANTS.page;
  const [tagInput, setTagInput] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  const tagSuggestions = useMemo(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return [];
    return allTags.filter(
      (kw) => kw.toLowerCase().includes(trimmed) && !tags.includes(kw)
    );
  }, [tagInput, allTags, tags]);

  function commitTag(tag) {
    const clean = tag.trim();
    if (!clean) return;
    if (!tags.includes(clean)) onChange([...tags, clean]);
    setTagInput("");
    setTagDropdownOpen(false);
  }

  function removeTag(tag) {
    onChange(tags.filter((t) => t !== tag));
  }

  function onTagInputKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (tagInput.trim()) commitTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === "Escape") {
      setTagDropdownOpen(false);
    }
  }

  return (
    <div className="relative">
      <div className={styles.container}>
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1.5 bg-navy text-white text-xs font-medium px-2.5 py-1 rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => {
            setTagInput(e.target.value);
            setTagDropdownOpen(true);
          }}
          onFocus={() => setTagDropdownOpen(true)}
          onBlur={() => setTimeout(() => setTagDropdownOpen(false), 150)}
          onKeyDown={onTagInputKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className={styles.input}
        />
      </div>
      {tagDropdownOpen && tagSuggestions.length > 0 && (
        <ul className={styles.dropdown}>
          {tagSuggestions.map((kw) => (
            <li key={kw}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitTag(kw)}
                className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-navy/5 hover:text-navy transition-colors"
              >
                {kw}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Fetches the full distinct keyword set across the library, for callers
 * that need a fresh query rather than deriving allTags from data already
 * in memory. app/library/page.js derives it locally with useMemo instead
 * of calling this, since it already has every abstract loaded for browsing.
 */
export async function fetchAllTags(supabase) {
  const { data } = await supabase.from("abstracts").select("keywords");
  if (!data) return [];
  const set = new Set();
  data.forEach((row) => (row.keywords || []).forEach((kw) => set.add(kw)));
  return Array.from(set).sort();
}
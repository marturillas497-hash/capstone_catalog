"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import AbstractModal from "@/components/shared/AbstractModal";
import { useEmbedding } from "@/components/shared/EmbeddingProvider";
import { Search, X, ChevronDown, BookOpen } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { sanitizeFilterValue } from "@/lib/postgrest";
import ScanProgress from "@/components/shared/ScanProgress";

const YEAR_OPTIONS = Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i);

// Two stages only, no advisory step, unlike /submit. Embedding reflects a
// real client-side promise, the search stage holds until the actual
// /api/library/search response resolves. See ScanProgress for why this is
// staged rather than a literal server-driven readout.
const SEARCH_STAGES = [
  { key: "embedding", label: "Generating embedding…", description: "Converting your query into a semantic fingerprint." },
  { key: "searching", label: "Searching the library…", description: "Comparing against the BSIS capstone archive." },
];

const SEARCH_TIMEOUT_MS = 45000;

// profile ({ role, fullName }) is resolved server-side in page.js and
// passed down as a prop, guaranteed present on first render. Navbar below
// used to wait on its own client-side fetch here, defaulting to
// { role: null, fullName: "" } in the meantime — since NAV_LINKS[null]
// doesn't exist, that meant an empty nav-link list (just the logo/sign-out
// shell) for as long as that fetch was in flight, on every page load.
export default function LibraryClient({ profile }) {
  const supabase = createClient();
  const { getEmbedding, isReady } = useEmbedding();

  const [abstracts, setAbstracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [semanticTipOpen, setSemanticTipOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStageIndex, setSearchStageIndex] = useState(0);
  const [selectedAbstract, setSelectedAbstract] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const searchTimeout = useRef(null);
  const lastSemanticQuery = useRef("");

  // Tag filter state
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [browseTagsOpen, setBrowseTagsOpen] = useState(false);
  const tagInputRef = useRef(null);
  const tagFilterWrapRef = useRef(null);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (tagFilterWrapRef.current && !tagFilterWrapRef.current.contains(e.target)) {
        setBrowseTagsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchAll() {
    setLoading(true);
    const { data, error } = await supabase
      .from("abstracts")
      .select("id, title, abstract_text, authors, year, accession_id, keywords")
      .order("created_at", { ascending: false });
    if (!error) setAbstracts(data || []);
    setLoading(false);
  }

  const handleSearch = useCallback(async (query, year) => {
    const trimmed = query.trim();

    if (!trimmed) {
      await fetchAll();
      return;
    }

    const wordCount = trimmed.split(/\s+/).length;

    if (wordCount <= 2) {
      setLoading(true);
      const safe = sanitizeFilterValue(trimmed);
      let q = supabase
        .from("abstracts")
        .select("id, title, abstract_text, authors, year, accession_id, keywords")
        .or(`title.ilike.%${safe}%,authors.ilike.%${safe}%,abstract_text.ilike.%${safe}%,accession_id.ilike.%${safe}%`);
      if (year) q = q.eq("year", year);
      const { data } = await q.order("created_at", { ascending: false });
      setAbstracts(data || []);
      setLoading(false);
      return;
    }

    if (!isReady) return;
    if (lastSemanticQuery.current === trimmed && !year) return;
    lastSemanticQuery.current = trimmed;

    setSearchLoading(true);
    setSearchStageIndex(0);

    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const embedding = await getEmbedding(trimmed);
      setSearchStageIndex(1);
      const res = await fetch("/api/library/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding, year: year ? parseInt(year) : null }),
        signal: controller.signal,
      });
      clearTimeout(abortTimer);
      const json = await res.json();
      setAbstracts(json.results || []);
    } catch (err) {
      clearTimeout(abortTimer);
      console.error("Search failed:", err);
      setAbstracts([]);
    } finally {
      setSearchLoading(false);
    }
  }, [isReady, getEmbedding, supabase]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    const wordCount = trimmed.split(/\s+/).length;

    if (!trimmed) {
      fetchAll();
      return;
    }

    if (wordCount <= 2) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => handleSearch(searchQuery, yearFilter), 200);
    }
  }, [searchQuery, yearFilter]);

  function onSearchSubmit(e) {
    e.preventDefault();
    handleSearch(searchQuery, yearFilter);
  }

  function openModal(abstract) {
    setSelectedAbstract(abstract);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedAbstract(null);
  }

  function handleAbstractUpdated(updated) {
    setAbstracts((prev) =>
      prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
    );
    setSelectedAbstract((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  }

  // Distinct tags across the currently loaded abstracts, used to populate the autocomplete dropdown
  const allTags = useMemo(() => {
    const set = new Set();
    abstracts.forEach((a) => {
      (a.keywords || []).forEach((kw) => set.add(kw));
    });
    return Array.from(set).sort();
  }, [abstracts]);

  const tagSuggestions = useMemo(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return [];
    return allTags.filter(
      (kw) => kw.toLowerCase().includes(trimmed) && !selectedTags.includes(kw)
    );
  }, [tagInput, allTags, selectedTags]);

  function commitTag(tag) {
    if (!tag) return;
    if (!selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setTagInput("");
    setTagDropdownOpen(false);
  }

  function toggleTag(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function removeTag(tag) {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }

  function onTagInputKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (!trimmed) return;
      // Only commit on an exact case-insensitive match against known tags
      const exact = allTags.find((kw) => kw.toLowerCase() === trimmed.toLowerCase());
      if (exact) {
        commitTag(exact);
      } else if (tagSuggestions.length > 0) {
        commitTag(tagSuggestions[0]);
      }
    } else if (e.key === "Backspace" && !tagInput && selectedTags.length > 0) {
      // Quick-remove the last pill when backspacing on an empty input
      removeTag(selectedTags[selectedTags.length - 1]);
    } else if (e.key === "Escape") {
      setTagDropdownOpen(false);
    }
  }

  const displayedAbstracts = abstracts.filter((a) => {
    if (yearFilter && a.year !== parseInt(yearFilter)) return false;
    if (selectedTags.length > 0) {
      const kws = a.keywords || [];
      const hasMatch = selectedTags.some((t) => kws.includes(t));
      if (!hasMatch) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-10">

        {/* Page header */}
        <PageHeader
          variant="stats"
          crumbs={["Library", "Browse"]}
          title="Capstone Library"
          icon={BookOpen}
          subtitle="Browse completed BSIS capstone studies. Use the accession ID to request the physical document from the librarian."
        />

        <form onSubmit={onSearchSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, author, topic, or accession ID..."
            className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30 placeholder:text-slate-400"
          />
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option value="">All Years</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={searchLoading || !searchQuery.trim()}
            className="flex items-center justify-center gap-2 bg-navy text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Search className="w-4 h-4" strokeWidth={1.75} />
            {searchLoading ? "Searching…" : "Search"}
          </button>
        </form>

        <p className="text-xs text-slate-500 mb-8 -mt-2">
          Type 1 or 2 words for instant keyword matching. 3 or more words triggers{" "}
          <span className="relative inline-block">
            <button
              type="button"
              onClick={() => setSemanticTipOpen((v) => !v)}
              onMouseEnter={() => setSemanticTipOpen(true)}
              onMouseLeave={() => setSemanticTipOpen(false)}
              onFocus={() => setSemanticTipOpen(true)}
              onBlur={() => setSemanticTipOpen(false)}
              aria-describedby="semantic-search-tip"
              className="text-orange font-medium underline decoration-dotted underline-offset-2 hover:text-orange-dark"
            >
              semantic search
            </button>
            {semanticTipOpen && (
              <span
                id="semantic-search-tip"
                role="tooltip"
                className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-navy text-white text-xs leading-relaxed rounded-lg px-3 py-2 shadow-neo"
              >
                Semantic search looks at what your query MEANS, not just the exact words.
                It can show studies that use different terms for the same idea.
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-navy rotate-45" />
              </span>
            )}
          </span>
          , comparing your query against the meaning of every abstract in the library.
        </p>

        {/* Tag filter */}
        <div className="mb-8">
          <div className="relative max-w-md" ref={tagFilterWrapRef}>
            <div className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg pl-3 pr-2 py-2 bg-white shadow-sm focus-within:ring-2 focus-within:ring-navy/30">
              {selectedTags.map((tag) => (
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
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setTagDropdownOpen(true);
                  setBrowseTagsOpen(false);
                }}
                onFocus={() => {
                  setTagDropdownOpen(true);
                  setBrowseTagsOpen(false);
                }}
                onBlur={() => setTimeout(() => setTagDropdownOpen(false), 150)}
                onKeyDown={onTagInputKeyDown}
                placeholder={selectedTags.length === 0 ? "Filter by tag…" : ""}
                className="flex-1 min-w-[100px] text-sm text-foreground bg-transparent focus:outline-none placeholder:text-slate-400 py-0.5"
              />
              <button
                type="button"
                onClick={() => {
                  setBrowseTagsOpen((v) => !v);
                  setTagDropdownOpen(false);
                }}
                aria-label="Browse all tags"
                className="shrink-0 p-1 rounded text-slate-400 hover:text-navy hover:bg-navy/5 transition-colors"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${browseTagsOpen ? "rotate-180" : ""}`}
                  strokeWidth={2}
                />
              </button>
            </div>

            {tagDropdownOpen && tagSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-background shadow-neo neo-transition rounded-lg max-h-48 overflow-y-auto">
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

            {browseTagsOpen && (
              <ul className="absolute z-10 mt-1 w-full bg-background shadow-neo neo-transition rounded-lg max-h-56 overflow-y-auto">
                {allTags.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-400">No tags in the library yet.</li>
                ) : (
                  allTags.map((kw) => {
                    const active = selectedTags.includes(kw);
                    return (
                      <li key={kw}>
                        <button
                          type="button"
                          onClick={() => toggleTag(kw)}
                          className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm transition-colors ${
                            active ? "bg-navy/5 text-navy font-medium" : "text-slate-600 hover:bg-navy/5 hover:text-navy"
                          }`}
                        >
                          {kw}
                          {active && <span className="text-navy text-xs">✓</span>}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        </div>

        {searchQuery.trim().split(/\s+/).length >= 3 && !isReady && (
          <p className="text-sm text-amber-600 mb-4">
            Semantic search model is loading. Keyword search is active in the meantime.
          </p>
        )}

        {searchLoading ? (
          <div className="bg-background shadow-neo neo-transition rounded-2xl">
            <ScanProgress stages={SEARCH_STAGES} activeIndex={searchStageIndex} />
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-background shadow-neo neo-transition rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-full mb-1" />
                <div className="h-3 bg-slate-100 rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : displayedAbstracts.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg font-medium">No abstracts found</p>
            <p className="text-sm mt-1">Try adjusting your search, year, or tag filter.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-4">
              {displayedAbstracts.length} result{displayedAbstracts.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {displayedAbstracts.map((abstract) => (
                <button
                  key={abstract.id}
                  onClick={() => openModal(abstract)}
                  className="text-left bg-background shadow-neo hover:shadow-neo-hover hover:-translate-y-1 active:shadow-neo-inset active:translate-y-0 neo-transition rounded-xl p-5 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {abstract.accession_id && (
                      <span className="text-xs font-mono text-navy bg-navy/5 px-2 py-0.5 rounded shrink-0">
                        {abstract.accession_id}
                      </span>
                    )}
                    {abstract.year && (
                      <span className="text-xs text-slate-400 shrink-0">{abstract.year}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm leading-snug mb-2 group-hover:text-navy transition-colors line-clamp-3">
                    {abstract.title}
                  </h3>
                  {abstract.authors && (
                    <p className="text-xs text-slate-500 mb-2 truncate">{abstract.authors}</p>
                  )}
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-2">
                    {abstract.abstract_text}
                  </p>
                  {abstract.keywords?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {abstract.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="text-[11px] bg-navy/5 text-navy px-2 py-0.5 rounded-full"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-300 italic">No tags</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      {selectedAbstract && (
        <AbstractModal
          abstract={selectedAbstract}
          isOpen={modalOpen}
          onClose={closeModal}
          isAdmin={profile.role === "admin"}
          onUpdated={handleAbstractUpdated}
          trackView={profile.role === "student"}
          allTags={allTags}
        />
      )}
    </div>
  );
}
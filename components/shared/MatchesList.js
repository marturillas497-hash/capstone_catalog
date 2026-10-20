"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import AbstractModal from "@/components/shared/AbstractModal";
import { getMatchRisk } from "@/lib/advisory";
import { RISK_PILL as RISK_BADGE_STYLES } from "@/lib/risk";

const PREVIEW_COUNT = 3;

export default function MatchesList({ matches, showAccessionNote = false }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [expanded, setExpanded] = useState(false);

  if (!matches || matches.length === 0) return null;

  const visibleMatches = expanded ? matches : matches.slice(0, PREVIEW_COUNT);
  const hasMore = matches.length > PREVIEW_COUNT;

  return (
    <>
      <div className="space-y-3">
        {visibleMatches.map((match, index) => {
          const risk = getMatchRisk(match.similarity);
          const badgeClass = RISK_BADGE_STYLES[risk];

          return (
            <div
              key={match.id ?? index}
              onClick={() => setSelectedMatch(match)}
              className="bg-background rounded-xl shadow-neo p-4 hover:shadow-neo-hover hover:-translate-y-1 active:shadow-neo-inset active:translate-y-0 neo-transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{match.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {match.authors && `${match.authors}, `}
                    {match.year && match.year}
                    {match.accession_id && `, ${match.accession_id}`}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${badgeClass}`}>
                  {(match.similarity * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2 line-clamp-2">{match.abstract_text}</p>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy transition"
        >
          {expanded ? (
            <>
              Show fewer matches
              <ChevronUp className="w-4 h-4" strokeWidth={1.75} />
            </>
          ) : (
            <>
              Show {matches.length - PREVIEW_COUNT} more matches
              <ChevronDown className="w-4 h-4" strokeWidth={1.75} />
            </>
          )}
        </button>
      )}

      <AbstractModal
        abstract={selectedMatch}
        isOpen={!!selectedMatch}
        onClose={() => setSelectedMatch(null)}
        showAccessionNote={showAccessionNote}
      />
    </>
  );
}
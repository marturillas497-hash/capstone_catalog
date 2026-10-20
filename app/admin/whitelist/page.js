"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import { UploadCloud, Search, User, AlertTriangle, CheckCircle2, RotateCcw, UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { STUDENT_ID_PATTERN, MAX_WHITELIST_ROWS, MAX_NAME_LENGTH, normalizeName, isValidName } from "@/lib/constants";

const STATUS_META = {
  new: { label: "New", className: "bg-navy/10 text-navy border-navy/20" },
  overwrite: { label: "Will update", className: "bg-orange/10 text-orange-dark border-orange/30" },
  unchanged: { label: "Unchanged", className: "bg-slate-100 text-slate-400 border-slate-200" },
  duplicate: { label: "Duplicate in file", className: "bg-red-50 text-red-600 border-red-200" },
  invalid: { label: "Missing ID", className: "bg-red-50 text-red-600 border-red-200" },
  invalid_name: { label: "Missing Name", className: "bg-red-50 text-red-600 border-red-200" },
  invalid_format: { label: "Invalid ID", className: "bg-red-50 text-red-600 border-red-200" },
  bad_name: { label: "Invalid Name", className: "bg-red-50 text-red-600 border-red-200" },
};

// Statuses that hard-block Confirm.
const BLOCKING = ["duplicate", "invalid", "invalid_name", "invalid_format", "bad_name"];

/*
 * Quote-aware CSV field split for a single line. Handles a name written
 * as "Dela Cruz, Juan" (comma inside double quotes, standard Excel/Sheets
 * export behavior) and "" as an escaped literal quote inside a quoted
 * field. Does not handle a quoted field spanning multiple physical lines,
 * names don't contain newlines, so this is a deliberate scope limit, not
 * an oversight.
 */
function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result.map((c) => c.trim());
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((raw, idx) => ({ raw, lineNo: idx + 1 }))
    .filter((l) => l.raw.trim().length > 0);
  if (lines.length === 0) throw new Error("The file is empty.");

  const header = parseCsvLine(lines[0].raw).map((h) => h.toLowerCase());
  const idCol = header.indexOf("id_number");
  const nameCol = header.indexOf("full_name");

  if (idCol === -1 || nameCol === -1) {
    throw new Error("The CSV must include a header row with columns: id_number, full_name.");
  }

  if (lines.length - 1 > MAX_WHITELIST_ROWS) {
    throw new Error(`The file has more than ${MAX_WHITELIST_ROWS} rows. Split it into smaller files and upload them separately.`);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const { raw, lineNo } = lines[i];
    const cols = parseCsvLine(raw);
    /* A stray unquoted comma (a name written without quotes) throws off
     * the column count. Fail loudly with the row number instead of
     * silently shifting every column after it. */
    if (cols.length !== header.length) {
      throw new Error(
        `Row ${lineNo} has ${cols.length} column${cols.length === 1 ? "" : "s"}, expected ${header.length}. ` +
        `If a name contains a comma (e.g. Dela Cruz, Juan), wrap it in double quotes and re-upload.`
      );
    }
    rows.push({
      rowNumber: lineNo,
      id_number: cols[idCol] || "",
      full_name: normalizeName(cols[nameCol]),
    });
  }

  if (rows.length === 0) throw new Error("No data rows found in the file.");
  return rows;
}

function classifyRows(rows, existingMap) {
  const counts = {};
  rows.forEach((r) => {
    if (r.id_number) counts[r.id_number] = (counts[r.id_number] || 0) + 1;
  });

  return rows.map((r) => {
    if (!r.id_number) return { ...r, status: "invalid" };
    if (!STUDENT_ID_PATTERN.test(r.id_number)) return { ...r, status: "invalid_format" };
    if (counts[r.id_number] > 1) return { ...r, status: "duplicate" };
    if (!r.full_name) return { ...r, status: "invalid_name" };
    if (!isValidName(r.full_name)) return { ...r, status: "bad_name" };

    const existing = existingMap.get(r.id_number);
    if (!existing) return { ...r, status: "new" };

    const nameMatches = normalizeName(existing.full_name) === r.full_name;
    return {
      ...r,
      status: nameMatches ? "unchanged" : "overwrite",
      existingName: existing.full_name,
      registered: existing.registered,
    };
  });
}

export default function WhitelistPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listError, setListError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ role: "admin", fullName: "" });

  const [dragActive, setDragActive] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewRows, setPreviewRows] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [flaggedReview, setFlaggedReview] = useState(null);

  // Manual add-a-student form, an alternative to the CSV upload above for
  // one-off additions. Reuses the same check and write endpoints the CSV
  // flow already uses rather than introducing new ones.
  const [addId, setAddId] = useState("");
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(null);
  const [addInfo, setAddInfo] = useState(null);
  const [addConflict, setAddConflict] = useState(null);

  const fileRef = useRef(null);
  const reqRef = useRef(0);

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
    }
    init();
  }, []);

  /* Only typing is debounced. A new search always returns to page 1. */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    fetchEntries(debouncedQuery, sort, page);
  }, [debouncedQuery, sort, page]);

  async function fetchEntries(q, s, p) {
    /* Ignore any response that a newer request has already superseded. */
    const id = ++reqRef.current;
    setLoading(true);
    setListError(false);
    try {
      const res = await fetch(`/api/admin/whitelist?q=${encodeURIComponent(q)}&sort=${s}&page=${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load whitelist");
      if (id !== reqRef.current) return;
      const pages = json.totalPages || 1;
      setEntries(json.entries || []);
      setTotal(json.total || 0);
      setTotalPages(pages);
      setPageSize(json.pageSize || 25);
      if (p > pages) setPage(pages);
    } catch {
      if (id !== reqRef.current) return;
      setEntries([]);
      setTotal(0);
      setListError(true);
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }

  async function handleFile(file) {
    setParseError(null);
    setUploadResult(null);
    setError(null);
    setPreviewRows(null);
    setFlaggedReview(null);

    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please upload a .csv file.");
      return;
    }

    let rows;
    try {
      const text = await file.text();
      rows = parseCsv(text);
    } catch (err) {
      setParseError(err.message);
      return;
    }

    setCheckingExisting(true);
    try {
      const uniqueIds = [...new Set(rows.map((r) => r.id_number).filter((id) => STUDENT_ID_PATTERN.test(id)))];
      const res = await fetch("/api/admin/whitelist/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: uniqueIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Check failed");
      const existingMap = new Map((json.existing || []).map((e) => [e.id_number, e]));
      setPreviewRows(classifyRows(rows, existingMap));
    } catch {
      setParseError("Could not check the file against the current whitelist. Try again.");
    } finally {
      setCheckingExisting(false);
    }
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragActive(true);
  }
  function onDragLeave(e) {
    e.preventDefault();
    setDragActive(false);
  }
  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function handleCancelPreview() {
    setPreviewRows(null);
    setParseError(null);
  }

  async function handleConfirm() {
    if (!previewRows) return;
    const overwriteRows = previewRows.filter((r) => r.status === "overwrite");
    const toSubmit = previewRows
      .filter((r) => r.status === "new" || r.status === "overwrite")
      .map((r) => ({ id_number: r.id_number, full_name: r.full_name }));

    if (toSubmit.length === 0) {
      setUploadResult("Nothing to update, every row already matches the current whitelist.");
      setPreviewRows(null);
      return;
    }

    setConfirming(true);
    try {
      const res = await fetch("/api/admin/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: toSubmit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setUploadResult(`${json.count} record${json.count !== 1 ? "s" : ""} uploaded successfully.`);
      setFlaggedReview(
        overwriteRows.length > 0
          ? overwriteRows.map((r) => ({
              id_number: r.id_number,
              oldName: r.existingName || "unnamed",
              newName: r.full_name || "unnamed",
              registered: r.registered,
            }))
          : null
      );
      setPreviewRows(null);
      await fetchEntries(debouncedQuery, sort, page);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  async function handleManualAdd(e) {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);
    setAddInfo(null);
    setAddConflict(null);

    const id_number = addId.trim();
    const full_name = normalizeName(addName);

    if (!id_number || !full_name) {
      setAddError("Both a student ID and full name are required.");
      return;
    }
    if (!STUDENT_ID_PATTERN.test(id_number)) {
      setAddError("Student ID must contain numbers only.");
      return;
    }
    if (!isValidName(full_name)) {
      setAddError(`Name must contain letters, no numbers, and be at most ${MAX_NAME_LENGTH} characters.`);
      return;
    }

    setAddBusy(true);
    try {
      const res = await fetch("/api/admin/whitelist/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id_number] }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json.error || "Could not check the whitelist. Try again.");
        return;
      }
      const existing = (json.existing || [])[0];

      if (existing && normalizeName(existing.full_name) === full_name) {
        setAddInfo(`${id_number} is already whitelisted under this exact name. Nothing to change.`);
        return;
      }

      if (existing) {
        /*
         * Name would change: same "overwrite" concept as the CSV preview,
         * shown here as an explicit confirm step since a single entry has
         * no preview table.
         */
        setAddConflict({ id_number, full_name, existingName: existing.full_name, registered: existing.registered });
        return;
      }

      await submitManualAdd(id_number, full_name);
    } catch {
      setAddError("Could not reach the server. Try again.");
    } finally {
      setAddBusy(false);
    }
  }

  async function submitManualAdd(id_number, full_name) {
    setAddBusy(true);
    try {
      const res = await fetch("/api/admin/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: [{ id_number, full_name }] }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json.error || "Failed to add student.");
        return;
      }
      setAddSuccess(`${full_name} (${id_number}) added to the whitelist.`);
      setAddId("");
      setAddName("");
      setAddConflict(null);
      await fetchEntries(debouncedQuery, sort, page);
    } catch {
      setAddError("Could not reach the server. Try again.");
    } finally {
      setAddBusy(false);
    }
  }

  function handleCancelConflict() {
    setAddConflict(null);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = rangeStart + entries.length - 1;

  const counts = { new: 0, overwrite: 0, unchanged: 0, duplicate: 0, invalid: 0, invalid_name: 0, invalid_format: 0, bad_name: 0 };
  if (previewRows) previewRows.forEach((r) => counts[r.status]++);
  const blockingCount = BLOCKING.reduce((n, k) => n + counts[k], 0);
  const blocking = blockingCount > 0;
  const changeCount = counts.new + counts.overwrite;
  const registeredOverwrites = previewRows
    ? previewRows.filter((r) => r.status === "overwrite" && r.registered).length
    : 0;

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          title="Student Whitelist"
          subtitle="Manage the pre-registration access control list. Only whitelisted student IDs can register."
          icon={User}
          iconBg="bg-gold"
        />

        <div className="bg-background shadow-neo neo-transition rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
            Upload CSV
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Required columns, <span className="font-mono">id_number</span> and <span className="font-mono">full_name</span>.
            A header row is required. Nothing is saved until you review and confirm.
          </p>

          {uploadResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700 mb-4">
              {uploadResult}
            </div>
          )}
          {flaggedReview && flaggedReview.length > 0 && (
            <div className="bg-orange/5 border border-orange/30 rounded-lg px-4 py-3 mb-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-orange-dark shrink-0 mt-0.5" strokeWidth={1.75} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-orange-dark mb-1">
                    {flaggedReview.length} name{flaggedReview.length !== 1 ? "s" : ""} updated, flagged for review
                  </p>
                  <p className="text-xs text-slate-500 mb-2.5">
                    These student IDs already existed under a different name, and the name from the file was applied.
                    Check these against the registrar's record. If one looks wrong, records cannot be edited here,
                    get a corrected file from the registrar and upload it again.
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {flaggedReview.map((r) => (
                      <div key={r.id_number} className="text-xs flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-foreground">{r.id_number}</span>
                        <span className="text-slate-400 truncate">{r.oldName}</span>
                        <span className="text-orange-dark">&rarr;</span>
                        <span className="text-orange-dark font-medium truncate">{r.newName}</span>
                        {r.registered && (
                          <span
                            className="text-[10px] text-slate-500 border border-slate-200 rounded-full px-1.5 py-px"
                            title="This student already has an account, which keeps its original name."
                          >
                            Has account
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setFlaggedReview(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600 mb-4">
              {error}
            </div>
          )}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600 mb-4">
              {parseError}
            </div>
          )}

          {!previewRows && !checkingExisting && (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer neo-transition
                ${dragActive ? "border-navy shadow-neo-inset" : "border-slate-200 shadow-neo hover:shadow-neo-hover hover:border-navy/30"}`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  handleFile(file);
                  e.target.value = "";
                }}
              />
              <UploadCloud className="w-8 h-8 text-slate-300 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-slate-600 font-medium">
                Drag and drop a CSV file here, or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">.csv files only</p>
            </div>
          )}

          {checkingExisting && (
            <div className="border-2 border-dashed border-slate-200 shadow-neo neo-transition rounded-xl p-8 text-center">
              <div className="w-6 h-6 border-2 border-navy/20 border-t-navy rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Checking against the current whitelist…</p>
            </div>
          )}

          {previewRows && !checkingExisting && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-navy/10 text-navy border-navy/20">
                  {counts.new} new
                </span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-orange/10 text-orange-dark border-orange/30">
                  {counts.overwrite} will update
                </span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-100 text-slate-400 border-slate-200">
                  {counts.unchanged} unchanged
                </span>
                {blocking && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-red-50 text-red-600 border-red-200">
                    {blockingCount} issue{blockingCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="bg-background shadow-neo neo-transition rounded-lg overflow-hidden mb-4 max-h-72 overflow-y-auto">
                <div className="grid grid-cols-12 px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide sticky top-0">
                  <span className="col-span-3">Row</span>
                  <span className="col-span-3">Student ID</span>
                  <span className="col-span-3">Name</span>
                  <span className="col-span-3 text-right">Status</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {previewRows.map((r) => {
                    const meta = STATUS_META[r.status];
                    const isIssue = BLOCKING.includes(r.status);
                    return (
                      <div
                        key={r.rowNumber}
                        className={`grid grid-cols-12 px-3 py-2 text-sm items-center ${isIssue ? "bg-red-50/50" : ""}`}
                      >
                        <span className="col-span-3 text-slate-400 text-xs">Row {r.rowNumber}</span>
                        <span className="col-span-3 font-mono text-foreground truncate">
                          {r.id_number || <span className="text-red-400 italic">missing</span>}
                        </span>
                        <span className="col-span-3 text-slate-600 truncate">
                          {r.full_name || <span className="text-slate-300 italic">unnamed</span>}
                        </span>
                        <span className="col-span-3 text-right">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${meta.className}`}>
                            {meta.label}
                          </span>
                          {r.status === "overwrite" && r.registered && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">Has account</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {registeredOverwrites > 0 && (
                <div className="bg-orange/5 border border-orange/30 rounded-lg px-4 py-3 mb-4 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-orange-dark shrink-0 mt-0.5" strokeWidth={1.75} />
                  <p className="text-sm text-slate-600">
                    Some updated names ({registeredOverwrites}) belong to students who already have an account.
                    The whitelist name will change, but the name on their account will not.
                  </p>
                </div>
              )}
              {blocking ? (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <p className="text-sm text-red-700">
                    Fix the flagged row{blockingCount !== 1 ? "s" : ""} in your file, then re-upload. Nothing has been saved yet.
                  </p>
                </div>
              ) : changeCount === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 flex gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <p className="text-sm text-slate-500">
                    Every row already matches the current whitelist, there is nothing to update.
                  </p>
                </div>
              ) : null}

              <div className="flex gap-2">
                <button
                  onClick={handleCancelPreview}
                  disabled={confirming}
                  className="inline-flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
                  Choose a different file
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={blocking || confirming || changeCount === 0}
                  className="inline-flex items-center gap-1.5 bg-navy text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
                  {confirming ? "Uploading…" : `Confirm Upload (${changeCount})`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-background shadow-neo neo-transition rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
            Add a Student Manually
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            For one-off additions. Bulk changes are faster through the CSV upload above.
          </p>

          {addSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700 mb-4">
              {addSuccess}
            </div>
          )}
          {addError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600 mb-4">
              {addError}
            </div>
          )}
          {addInfo && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-600 mb-4">
              {addInfo}
            </div>
          )}

          {addConflict ? (
            <div className="bg-orange/5 border border-orange/30 rounded-lg px-4 py-3">
              <div className="flex items-start gap-2.5 mb-3">
                <AlertTriangle className="w-4 h-4 text-orange-dark shrink-0 mt-0.5" strokeWidth={1.75} />
                <p className="text-sm text-slate-700">
                  Student ID <span className="font-mono">{addConflict.id_number}</span> is
                  already whitelisted as{" "}
                  <span className="font-medium">{addConflict.existingName}</span>. Adding it
                  now will overwrite that name with{" "}
                  <span className="font-medium">{addConflict.full_name}</span>.
                  {addConflict.registered && " This student already has an account, which keeps its original name."}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => submitManualAdd(addConflict.id_number, addConflict.full_name)}
                  disabled={addBusy}
                  className="inline-flex items-center gap-1.5 bg-orange text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-orange-dark transition-colors disabled:opacity-50"
                >
                  {addBusy ? "Updating…" : "Overwrite Name"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelConflict}
                  disabled={addBusy}
                  className="inline-flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleManualAdd} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={20}
                value={addId}
                onChange={(e) => setAddId(e.target.value.replace(/\D/g, ""))}
                placeholder="Student ID"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <input
                type="text"
                maxLength={MAX_NAME_LENGTH}
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Full name"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <button
                type="submit"
                disabled={addBusy}
                className="inline-flex items-center justify-center gap-1.5 bg-navy text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <UserPlus className="w-4 h-4" strokeWidth={1.75} />
                {addBusy ? "Checking…" : "Add"}
              </button>
            </form>
          )}
        </div>

        <div className="mb-4 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student ID or name..."
              className="w-full border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option value="date">Newest first</option>
            <option value="name">Name (A to Z)</option>
            <option value="id">Student ID</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-background shadow-neo neo-transition rounded-lg px-4 py-3 animate-pulse h-12" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-base font-medium">{listError ? "Could not load the whitelist" : "No entries found"}</p>
            <p className="text-sm mt-1">
              {listError ? "Check your connection and try again." : "Upload a CSV to populate the whitelist."}
            </p>
          </div>
        ) : (
          <div className="bg-background shadow-neo neo-transition rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
              <span className="col-span-4">Student ID</span>
              <span className="col-span-5">Name</span>
              <span className="col-span-3 text-right">Added</span>
            </div>
            <div className="divide-y divide-slate-50">
              {entries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-12 px-4 py-3 text-sm items-center">
                  <span className="col-span-4 font-mono text-foreground">{entry.id_number}</span>
                  <span className="col-span-5 text-slate-600 truncate">{entry.full_name || <span className="text-slate-300 italic">unnamed</span>}</span>
                  <span className="col-span-3 text-xs text-slate-400 text-right">{formatDate(entry.created_at)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing {rangeStart} to {rangeEnd} of {total.toLocaleString()} entr{total !== 1 ? "ies" : "y"}
              </span>
              <div className="flex items-center gap-2">
                <span>Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
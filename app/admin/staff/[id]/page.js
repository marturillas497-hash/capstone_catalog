import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getAuthHeaders } from "@/lib/authHeaders";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" });

// Admin only (middleware covers /admin). Read-only list of one staff member's abstracts.
export default async function StaffMemberAbstractsPage({ params, searchParams }) {
  const me = await getAuthHeaders();
  if (!me || me.role !== "admin") redirect("/login");

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const [{ data: staff }, { data: rows, count }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", id).eq("role", "staff").maybeSingle(),
    // Only the columns the list shows. Never the abstract text or the embedding.
    supabase
      .from("abstracts")
      .select("id, title, accession_id, year, created_at, updated_at", { count: "exact" })
      .eq("added_by", id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
  ]);
  if (!staff) notFound();

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={me.role} fullName={me.fullName} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          crumbs={["Staff", staff.full_name]}
          title={staff.full_name}
          subtitle="Abstracts this staff member added to the library"
          icon={FileText}
          badge={
            <span className="bg-orange/10 text-[#B84E00] text-[13px] font-bold rounded-full px-2.5 py-0.5">
              {total}
            </span>
          }
        />

        <Link href="/admin/staff" className="inline-flex items-center gap-1 text-sm text-navy hover:underline mb-4">
          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
          All staff
        </Link>

        {(rows ?? []).length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-base font-medium">No abstracts added yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((a) => (
              <div key={a.id} className="bg-background shadow-neo rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-slate-700">{a.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {[a.accession_id, a.year, `Added ${formatDate(a.created_at)}`, a.updated_at && `Edited ${formatDate(a.updated_at)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={`?page=${page - 1}`} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                </Link>
              ) : (
                <span className="p-1.5 rounded-lg border border-slate-200 opacity-40"><ChevronLeft className="w-4 h-4" strokeWidth={1.75} /></span>
              )}
              {page < totalPages ? (
                <Link href={`?page=${page + 1}`} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                </Link>
              ) : (
                <span className="p-1.5 rounded-lg border border-slate-200 opacity-40"><ChevronRight className="w-4 h-4" strokeWidth={1.75} /></span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

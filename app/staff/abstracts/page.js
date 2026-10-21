import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import { FileText, Pencil, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" });

export default async function StaffAbstractsPage({ searchParams }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "staff") redirect("/login");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  // Only the columns the list shows. Never the abstract text or the embedding.
  const { data: rows, count } = await supabase
    .from("abstracts")
    .select("id, title, accession_id, year, created_at, updated_at", { count: "exact" })
    .eq("added_by", user.id)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          title="My Abstracts"
          subtitle="Abstracts you added to the library"
          icon={FileText}
          badge={
            <span className="bg-orange/10 text-[#B84E00] text-[13px] font-bold rounded-full px-2.5 py-0.5">
              {total}
            </span>
          }
        />

        {(rows ?? []).length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-base font-medium">You have not added any abstracts yet.</p>
            <Link href="/staff/add" className="text-sm text-navy underline mt-2 inline-block">
              Add your first abstract
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((a) => (
              <Link
                key={a.id}
                href={`/staff/abstracts/${a.id}`}
                className="flex items-center justify-between bg-background shadow-neo hover:shadow-neo-hover hover:-translate-y-1 active:shadow-neo-inset active:translate-y-0 neo-transition rounded-lg px-4 py-3 group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate group-hover:text-navy transition-colors">
                    {a.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[a.accession_id, a.year, `Added ${formatDate(a.created_at)}`, a.updated_at && `Edited ${formatDate(a.updated_at)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-navy shrink-0 ml-4">
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Edit
                </span>
              </Link>
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

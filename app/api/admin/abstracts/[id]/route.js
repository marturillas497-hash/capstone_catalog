import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, abstract_text, authors, year, accession_id, embedding, keywords } = body;

    if (!title || !abstract_text) {
      return NextResponse.json({ error: "Title and abstract text are required" }, { status: 400 });
    }

    if (!authors || !authors.trim()) {
      return NextResponse.json({ error: "Authors is required" }, { status: 400 });
    }

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 384) {
      return NextResponse.json({ error: "Invalid embedding" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("abstracts")
      .update({
        title,
        abstract_text,
        authors,
        year: year || null,
        accession_id: accession_id || null,
        embedding: `[${embedding.join(",")}]`,
        keywords: Array.isArray(keywords) ? keywords : [],
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        const field = error.message.includes("title") ? "title" : "accession ID";
        return NextResponse.json({ error: `A record with this ${field} already exists` }, { status: 409 });
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 });
    }

    return NextResponse.json({ abstract: data });
  } catch (err) {
    console.error("[PATCH /api/admin/abstracts/[id]]", err);
    return NextResponse.json({ error: "Failed to update abstract" }, { status: 500 });
  }
}
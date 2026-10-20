import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAuthHeaders } from "@/lib/authHeaders";
import LibraryClient from "./LibraryClient";

/*
  Profile/role come from middleware.js's forwarded headers when available,
  falling back to a direct Supabase query only if those headers are missing.
*/
export default async function LibraryPage() {
  const forwarded = await getAuthHeaders();

  let role = forwarded?.role;
  let fullName = forwarded?.fullName;

  if (!role) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    if (!profile) redirect("/login");

    role = profile.role;
    fullName = profile.full_name;
  }

  return <LibraryClient profile={{ role, fullName }} />;
}
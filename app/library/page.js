import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LibraryClient from "./LibraryClient";

/*
  The profile (role, name, program) and the program list are read here, so the
  first render of the client already has them. Students and advisers start on
  their own program. Admin and staff have no program and start on all programs.
*/
export default async function LibraryPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: programs }] = await Promise.all([
    supabase.from("profiles").select("full_name, role, program_id").eq("id", user.id).single(),
    supabase.from("programs").select("id, code, name").order("name"),
  ]);
  if (!profile) redirect("/login");

  return (
    <LibraryClient
      profile={{ role: profile.role, fullName: profile.full_name }}
      programs={programs ?? []}
      ownProgramId={profile.program_id ?? null}
    />
  );
}

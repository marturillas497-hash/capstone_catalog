import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAuthHeaders } from "@/lib/authHeaders";
import ProfileClient from "./ProfileClient";

const PROFILE_ALLOWED_ROLES = ["student", "capstone_adviser"];

export default async function ProfilePage() {
  const forwarded = await getAuthHeaders();

  let userId = forwarded?.userId;
  let role = forwarded?.role;
  let fullName = forwarded?.fullName;
  let status = forwarded?.status;
  let email = forwarded?.email;

  if (!userId || !role) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, status")
      .eq("id", user.id)
      .single();

    if (!profile) redirect("/login");

    userId = user.id;
    role = profile.role;
    fullName = profile.full_name;
    status = profile.status;
    email = user.email;
  }

  if (!PROFILE_ALLOWED_ROLES.includes(role)) redirect("/login");

  return (
    <ProfileClient profile={{ id: userId, full_name: fullName, role, status, email }} />
  );
}
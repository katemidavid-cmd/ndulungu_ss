import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardRoot() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "headmaster") redirect("/dashboard/headmaster");
  if (profile?.role === "academic") redirect("/dashboard/academic");
  if (profile?.role === "teacher") redirect("/dashboard/teacher");

  redirect("/login");
}

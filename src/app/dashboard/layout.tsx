import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("id", user.id)
    .single();
  const { data: schoolSettings } = await supabase
    .from("school_settings")
    .select("school_name, school_logo_url, union_logo_url")
    .eq("id", 1)
    .maybeSingle();
  const { data: academicPeriod, error: academicPeriodError } = await supabase
    .from("academic_period_settings")
    .select("academic_year, term")
    .eq("id", 1)
    .maybeSingle();

  const role = profile?.role as "headmaster" | "academic" | "teacher";

  if (!role || !["headmaster", "academic", "teacher"].includes(role)) {
    redirect("/login");
  }
  const academicSettingsHref =
    role === "headmaster"
      ? "/dashboard/headmaster/settings"
      : "/dashboard/academic/settings";

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      <Sidebar
        role={role}
        school={{
          name: schoolSettings?.school_name || "Ndulungu Secondary School",
          logoUrl: schoolSettings?.school_logo_url ?? null,
          unionLogoUrl: schoolSettings?.union_logo_url ?? null,
        }}
        user={{
          name: profile?.full_name || user.email || "",
          email: profile?.email || user.email || "",
          role: role,
        }}
      />
      <div className="overflow-x-hidden lg:pl-72">
        <Header
          title="Dashboard"
          user={{
            name: profile?.full_name || user.email || "",
            email: profile?.email || user.email || "",
            role: role,
          }}
        />
        <div className="px-4 pt-4 sm:px-6">
          <div
            className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
              academicPeriod && !academicPeriodError
                ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
              <div>
                <p className="text-sm font-semibold">Active Academic Period</p>
                {academicPeriod && !academicPeriodError ? (
                  <p className="mt-0.5 text-sm">
                    Academic Year {academicPeriod.academic_year} · {academicPeriod.term}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm">
                    {academicPeriodError
                      ? "Academic period setup is unavailable. Apply the exam-management database migration."
                      : "No active year or term is set. Configure it before creating exams."}
                  </p>
                )}
              </div>
            </div>
            {(role === "headmaster" || role === "academic") && (
              <Link
                href={academicSettingsHref}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-indigo-300 bg-white px-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
              >
                Set academic period
              </Link>
            )}
          </div>
        </div>
        <main className="overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const role = profile?.role as "headmaster" | "academic" | "teacher";

  if (!role || !["headmaster", "academic", "teacher"].includes(role)) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        role={role}
        user={{
          name: profile?.full_name || user.email || "",
          email: profile?.email || user.email || "",
          role: role,
        }}
      />
      <div className="lg:pl-64">
        <Header
          title="Dashboard"
          user={{
            name: profile?.full_name || user.email || "",
            email: profile?.email || user.email || "",
            role: role,
          }}
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

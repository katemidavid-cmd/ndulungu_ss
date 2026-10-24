"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  FileText,
  ClipboardList,
  Settings,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const navByRole: Record<string, NavItem[]> = {
  headmaster: [
    { label: "Dashboard", href: "/dashboard/headmaster", icon: LayoutDashboard },
    { label: "Teachers", href: "/dashboard/headmaster/teachers", icon: Users },
    { label: "Students", href: "/dashboard/headmaster/students", icon: GraduationCap },
    { label: "Classes", href: "/dashboard/headmaster/classes", icon: BookOpen },
    { label: "Subjects", href: "/dashboard/headmaster/subjects", icon: ClipboardList },
    { label: "Results", href: "/dashboard/headmaster/results", icon: FileText },
    { label: "Settings", href: "/dashboard/headmaster/settings", icon: Settings },
  ],
  academic: [
    { label: "Dashboard", href: "/dashboard/academic", icon: LayoutDashboard },
    { label: "Teachers", href: "/dashboard/academic/teachers", icon: Users },
    { label: "Classes", href: "/dashboard/academic/classes", icon: BookOpen },
    { label: "Students", href: "/dashboard/academic/students", icon: GraduationCap },
    { label: "Subjects", href: "/dashboard/academic/subjects", icon: ClipboardList },
    { label: "Assignments", href: "/dashboard/academic/assignments", icon: Users },
    { label: "Results", href: "/dashboard/academic/results", icon: FileText },
  ],
  teacher: [
    { label: "Dashboard", href: "/dashboard/teacher", icon: LayoutDashboard },
    { label: "My Classes", href: "/dashboard/teacher/classes", icon: BookOpen },
    { label: "Enter Marks", href: "/dashboard/teacher/marks", icon: FileText },
    { label: "Results", href: "/dashboard/teacher/results", icon: ClipboardList },
  ],
};

export function Sidebar({
  role,
}: {
  role: "headmaster" | "academic" | "teacher";
  user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const items = navByRole[role] || [];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-lg font-semibold">Ndulungu Secondary School</h2>
        <p className="text-xs text-slate-400 mt-1">Results Management System</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

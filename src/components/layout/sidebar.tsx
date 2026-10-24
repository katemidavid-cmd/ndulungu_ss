"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  FileText,
  ClipboardList,
  Settings,
  X,
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
    { label: "Assignments", href: "/dashboard/headmaster/assignments", icon: ClipboardList },
    { label: "Results", href: "/dashboard/headmaster/results", icon: FileText },
    { label: "Settings", href: "/dashboard/headmaster/settings", icon: Settings },
  ],
  academic: [
    { label: "Dashboard", href: "/dashboard/academic", icon: LayoutDashboard },
    { label: "Teachers", href: "/dashboard/academic/teachers", icon: Users },
    { label: "Classes", href: "/dashboard/academic/classes", icon: BookOpen },
    { label: "Students", href: "/dashboard/academic/students", icon: GraduationCap },
    { label: "Subjects", href: "/dashboard/academic/subjects", icon: ClipboardList },
    { label: "Assignments", href: "/dashboard/academic/assignments", icon: ClipboardList },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navByRole[role] || [];

  useEffect(() => {
    const sync = () => setMobileOpen(document.body.classList.contains("mobile-nav-open"));
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const closeMobileNav = () => {
    document.body.classList.remove("mobile-nav-open");
    setMobileOpen(false);
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/50 transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeMobileNav}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col bg-slate-900 text-white shadow-2xl transition-transform duration-200 ease-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <h2 className="text-base font-semibold">Ndulungu Secondary School</h2>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Results System
            </p>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white lg:hidden"
            onClick={closeMobileNav}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileNav}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

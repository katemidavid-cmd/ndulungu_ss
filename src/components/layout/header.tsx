"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { UserMenu } from "./user-menu";

export function Header({
  title,
  user,
}: {
  title: string;
  user: { name: string; email: string; role: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="lg:hidden" onClick={() => setOpen(!open)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>
        <UserMenu user={user} />
      </div>
    </header>
  );
}

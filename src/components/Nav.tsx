"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Upload, Tags, KeyRound, Calculator, Users } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/keywords", label: "Keywords", icon: KeyRound },
  { href: "/sip", label: "SIP Calc", icon: Calculator },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/import", label: "Import", icon: Upload },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-gray-100">
          <img src="/logo.png" alt="Centsible" className="w-7 h-7" />
          Centsible
        </Link>
        <div className="flex gap-1 flex-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <l.icon className="w-4 h-4" />
                {l.label}
              </Link>
            );
          })}
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}

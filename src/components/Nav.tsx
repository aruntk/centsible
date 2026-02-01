"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Upload, Tags, KeyRound, Calculator, Users } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/keywords", label: "Keywords", icon: KeyRound },
  { href: "/sip", label: "SIP Calc", icon: Calculator },
  { href: "/friends", label: "Friends", icon: Users },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900">
          <img src="/logo.png" alt="Centsible" className="w-7 h-7" />
          Centsible
        </Link>
        <div className="flex gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <l.icon className="w-4 h-4" />
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

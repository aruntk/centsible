"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  List,
  Upload,
  Tags,
  KeyRound,
  Calculator,
  Users,
  RefreshCw,
  MoreHorizontal,
  X,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/keywords", label: "Keywords", icon: KeyRound },
  { href: "/sip", label: "SIP Calc", icon: Calculator },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/updates", label: "Updates", icon: RefreshCw },
];

// Primary tabs shown in bottom bar on mobile
const primaryLinks = links.slice(0, 4);
// Secondary links shown in "More" menu
const secondaryLinks = links.slice(4);

export default function Nav() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    // Check if running on Capacitor (mobile)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const capacitor = (window as any).Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      setIsMobile(true);
    }
  }, []);

  // Close more menu when navigating
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const isSecondaryActive = secondaryLinks.some((l) => l.href === pathname);

  // Desktop navigation
  if (!isMobile) {
    return (
      <nav
        className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-50"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
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

  // Mobile navigation
  return (
    <>
      {/* Top header - minimal */}
      <header
        className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-50"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center justify-between h-12 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
            <img src="/logo.png" alt="Centsible" className="w-6 h-6" />
            <span className="text-base">Centsible</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t dark:border-gray-800 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-14">
          {primaryLinks.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 ${
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <l.icon className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 font-medium">{l.label}</span>
              </Link>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 ${
              isSecondaryActive || moreOpen
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {moreOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            <span className="text-[10px] mt-0.5 font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More menu overlay */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="fixed bottom-16 left-4 right-4 bg-white dark:bg-gray-900 rounded-xl shadow-xl z-50 overflow-hidden border dark:border-gray-800"
            style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {secondaryLinks.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 border-b dark:border-gray-800 last:border-b-0 ${
                    active
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <l.icon className="w-5 h-5" />
                  <span className="font-medium">{l.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Spacer for bottom nav */}
      <div className="h-14" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
    </>
  );
}

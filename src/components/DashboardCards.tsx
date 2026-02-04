"use client";

import { TrendingDown, TrendingUp, ArrowDownLeft, ArrowUpRight, PiggyBank, HandCoins } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardCards({ totalIncome, totalExpenses, totalInvestments, totalLoans, openingBalance, closingBalance }: {
  totalIncome: number;
  totalExpenses: number;
  totalInvestments?: number;
  totalLoans?: number;
  openingBalance?: number;
  closingBalance?: number;
}) {
  const cards = [
    { label: "Opening Balance", value: openingBalance ?? 0, icon: ArrowDownLeft, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/30", show: openingBalance != null },
    { label: "Total Income", value: totalIncome, icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", show: true },
    { label: "Total Expenses", value: totalExpenses, icon: TrendingDown, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30", show: true },
    { label: "Investments", value: totalInvestments ?? 0, icon: PiggyBank, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-900/30", show: totalInvestments != null },
    { label: "Loans", value: totalLoans ?? 0, icon: HandCoins, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/50", show: totalLoans != null },
    { label: "Closing Balance", value: closingBalance ?? 0, icon: ArrowUpRight, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30", show: closingBalance != null },
  ].filter(c => c.show);

  const gridCols = cards.length > 3
    ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
    : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className={`grid ${gridCols} gap-2 sm:gap-4`}>
      {cards.map((c) => (
        <div key={c.label} className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.label}</p>
              <p className={`text-sm sm:text-lg xl:text-xl font-bold mt-0.5 ${c.color}`}>{formatCurrency(c.value)}</p>
            </div>
            <div className={`p-1.5 sm:p-2 rounded-lg ${c.bg} shrink-0`}>
              <c.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${c.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

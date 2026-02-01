"use client";

import { TrendingDown, TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardCards({ totalIncome, totalExpenses, balance, openingBalance, closingBalance }: {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  openingBalance?: number;
  closingBalance?: number;
}) {
  const cards = [
    { label: "Opening Balance", value: openingBalance ?? 0, icon: ArrowDownLeft, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/30", show: openingBalance != null },
    { label: "Total Income", value: totalIncome, icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", show: true },
    { label: "Total Expenses", value: totalExpenses, icon: TrendingDown, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30", show: true },
    { label: "Net Balance", value: balance, icon: Wallet, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", show: true },
    { label: "Closing Balance", value: closingBalance ?? 0, icon: ArrowUpRight, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30", show: closingBalance != null },
  ].filter(c => c.show);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 ${cards.length > 3 ? "lg:grid-cols-5" : ""} gap-4`}>
      {cards.map((c) => (
        <div key={c.label} className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{formatCurrency(c.value)}</p>
            </div>
            <div className={`p-3 rounded-lg ${c.bg}`}>
              <c.icon className={`w-6 h-6 ${c.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

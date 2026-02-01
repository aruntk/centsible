"use client";

import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardCards({ totalIncome, totalExpenses, balance }: {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}) {
  const cards = [
    { label: "Total Income", value: totalIncome, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Expenses", value: totalExpenses, icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
    { label: "Net Balance", value: balance, icon: Wallet, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{c.label}</p>
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

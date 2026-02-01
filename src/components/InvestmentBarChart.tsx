"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function InvestmentBarChart({ data }: {
  data: { month: string; total: number }[];
}) {
  if (!data?.length) return <div className="text-gray-400 text-center py-10">No investment data</div>;

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(value) => formatCurrency(value as number)} />
        <Bar dataKey="total" fill="#0ea5e9" name="Investment" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

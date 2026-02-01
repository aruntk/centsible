"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#a855f7",
  "#d946ef", "#f43f5e", "#0ea5e9", "#6b7280",
];

export default function CategoryPieChart({ data }: {
  data: { category: string; total: number; count: number }[];
}) {
  if (!data?.length) return <div className="text-gray-400 text-center py-10">No data</div>;

  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="category"
          cx="50%"
          cy="45%"
          outerRadius={100}
          innerRadius={50}
          paddingAngle={1}
          label={false}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => {
            const v = Number(value) || 0;
            return [`${formatCurrency(v)} (${((v / total) * 100).toFixed(1)}%)`, name];
          }}
        />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ fontSize: 12, maxHeight: 80, overflowY: "auto" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

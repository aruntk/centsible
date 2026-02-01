"use client";

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "bg-red-100 text-red-700",
  Shopping: "bg-orange-100 text-orange-700",
  Transport: "bg-yellow-100 text-yellow-700",
  "Bills & Utilities": "bg-lime-100 text-lime-700",
  Transfers: "bg-green-100 text-green-700",
  "Salary/Income": "bg-emerald-100 text-emerald-700",
  Entertainment: "bg-cyan-100 text-cyan-700",
  Health: "bg-blue-100 text-blue-700",
  Education: "bg-violet-100 text-violet-700",
  "ATM Withdrawal": "bg-purple-100 text-purple-700",
  "Credit Card": "bg-fuchsia-100 text-fuchsia-700",
  "Taxes & Charges": "bg-rose-100 text-rose-700",
  Investments: "bg-sky-100 text-sky-700",
  Vices: "bg-red-100 text-red-800",
  Subscriptions: "bg-violet-100 text-violet-700",
  "Family & Friends": "bg-amber-100 text-amber-700",
  Loans: "bg-slate-100 text-slate-700",
  Grocery: "bg-green-100 text-green-700",
  "Real Estate": "bg-yellow-100 text-yellow-800",
  CCBILL: "bg-sky-100 text-sky-800",
  Gold: "bg-yellow-50 text-yellow-700",
  Car: "bg-slate-100 text-slate-700",
  Fraud: "bg-red-200 text-red-800",
  Travel: "bg-cyan-100 text-cyan-700",
  Other: "bg-gray-100 text-gray-700",
};

export default function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] || CATEGORY_COLORS["Other"];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {category}
    </span>
  );
}

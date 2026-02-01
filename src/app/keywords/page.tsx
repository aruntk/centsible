"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, Plus } from "lucide-react";

type Keyword = {
  keyword: string;
  count: number;
  samples: string[];
  has_rule: boolean;
};

type Category = {
  id: number;
  name: string;
};

const PRIORITIES = [1, 3, 5, 8, 10, 15];

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<number>(0);
  const [priority, setPriority] = useState(5);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetch("/api/keywords").then((r) => r.json()).then((d) => setKeywords(d.keywords));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/categories").then((r) => r.json()).then((d) => {
      setCategories(d.categories || d);
      if (d.categories?.length) setSelectedCat(d.categories[0].id);
      else if (d.length) setSelectedCat(d[0].id);
    });
  }, [load]);

  const createRule = async (keyword: string) => {
    setLoading(true);
    await fetch("/api/categories/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: selectedCat,
        keyword,
        priority,
        apply_existing: true,
      }),
    });
    setCreating(null);
    setLoading(false);
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recurring Keywords</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Frequently occurring terms from your transaction narrations. Create rules to auto-categorize matching transactions.
      </p>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Keyword</th>
              <th className="text-right px-4 py-3 font-medium">Count</th>
              <th className="text-left px-4 py-3 font-medium">Sample Narrations</th>
              <th className="text-center px-4 py-3 font-medium">Has Rule</th>
              <th className="text-left px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {keywords.map((kw) => (
              <tr key={kw.keyword} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-medium">{kw.keyword}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">{kw.count}</td>
                <td className="px-4 py-2.5 max-w-[400px]">
                  {kw.samples.map((s, i) => (
                    <div key={i} className="truncate text-gray-500 dark:text-gray-400 text-xs" title={s}>{s}</div>
                  ))}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {kw.has_rule && <CheckCircle className="w-4 h-4 text-emerald-500 inline" />}
                </td>
                <td className="px-4 py-2.5">
                  {creating === kw.keyword ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCat}
                        onChange={(e) => setSelectedCat(Number(e.target.value))}
                        className="border dark:border-gray-700 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800 dark:text-gray-200"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(Number(e.target.value))}
                        className="border dark:border-gray-700 rounded px-2 py-1 text-xs w-16 bg-white dark:bg-gray-800 dark:text-gray-200"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>P{p}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => createRule(kw.keyword)}
                        disabled={loading}
                        className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1 rounded text-xs hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setCreating(null)}
                        className="text-gray-400 hover:text-gray-600 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    !kw.has_rule && (
                      <button
                        onClick={() => setCreating(kw.keyword)}
                        className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                      >
                        <Plus className="w-3 h-3" /> Create Rule
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

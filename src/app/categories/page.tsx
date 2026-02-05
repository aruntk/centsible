"use client";

import { useEffect, useState, useCallback } from "react";
import CategoryBadge from "@/components/CategoryBadge";
import { writeFileToDocuments } from "@/lib/file-picker";
import { isCapacitor } from "@/lib/platform";
import { Trash2, Plus, RefreshCw, Pencil, Check, X, Download, Upload, AlertTriangle } from "lucide-react";

type CategoryGroup = 'income' | 'living_expenditure' | 'loan' | 'investment' | 'other';
type Category = { id: number; name: string; color: string; icon: string; category_group: CategoryGroup };

const CATEGORY_GROUPS: { value: CategoryGroup; label: string }[] = [
  { value: "living_expenditure", label: "Living Expense" },
  { value: "income", label: "Income" },
  { value: "loan", label: "Loan" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
];
type Rule = {
  id: number; category_id: number; keyword: string | null; priority: number; category_name: string;
  condition_field: string | null; condition_op: string | null; condition_value: number | null; condition_value2: number | null;
};

const OPS = [
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
  { value: "between", label: "between" },
];

function formatCondition(r: Rule): string {
  if (!r.condition_field || !r.condition_op || r.condition_value == null) return "";
  if (r.condition_op === "between" && r.condition_value2 != null) {
    return `${r.condition_field} ${r.condition_value}–${r.condition_value2}`;
  }
  const op = OPS.find((o) => o.value === r.condition_op)?.label ?? r.condition_op;
  return `${r.condition_field} ${op} ${r.condition_value}`;
}

type EditState = {
  category_id: number;
  keyword: string;
  priority: number;
  condField: string;
  condOp: string;
  condValue: string;
  condValue2: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCatId, setNewCatId] = useState<number>(0);
  const [newPriority, setNewPriority] = useState(5);
  const [applyExisting, setApplyExisting] = useState(true);
  const [condField, setCondField] = useState("");
  const [condOp, setCondOp] = useState("gt");
  const [condValue, setCondValue] = useState("");
  const [condValue2, setCondValue2] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6b7280");
  const [newCatGroup, setNewCatGroup] = useState<CategoryGroup>("living_expenditure");
  const [newCatError, setNewCatError] = useState("");
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatColor, setEditCatColor] = useState("");
  const [editCatGroup, setEditCatGroup] = useState<CategoryGroup>("other");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const load = useCallback(async () => {
    if (isCapacitor()) {
      const { initClientDb, getCategories, getCategoryRules } = await import("@/lib/db-client");
      await initClientDb();
      const cats = await getCategories();
      const rls = await getCategoryRules();
      setCategories(cats);
      setRules(rls);
      if (cats.length && !newCatId) setNewCatId(cats[0].id);
    } else {
      const res = await fetch("/api/categories");
      const d = await res.json();
      setCategories(d.categories);
      setRules(d.rules);
      if (d.categories.length && !newCatId) setNewCatId(d.categories[0].id);
    }
  }, [newCatId]);

  useEffect(() => {
    load();
  }, [load]);

  const addRule = async () => {
    if (!newKeyword.trim() && !condField) return;

    if (isCapacitor()) {
      const { initClientDb, createCategoryRule } = await import("@/lib/db-client");
      await initClientDb();
      await createCategoryRule({
        category_id: newCatId,
        keyword: newKeyword.trim() || null,
        priority: newPriority,
        condition_field: condField || null,
        condition_op: condField ? condOp : null,
        condition_value: condField && condValue ? Number(condValue) : null,
        condition_value2: condField && condOp === "between" && condValue2 ? Number(condValue2) : null,
      });
    } else {
      const body: Record<string, unknown> = {
        category_id: newCatId,
        priority: newPriority,
        apply_existing: applyExisting,
      };
      if (newKeyword.trim()) body.keyword = newKeyword.trim();
      if (condField && condValue) {
        body.condition_field = condField;
        body.condition_op = condOp;
        body.condition_value = Number(condValue);
        if (condOp === "between" && condValue2) {
          body.condition_value2 = Number(condValue2);
        }
      }
      await fetch("/api/categories/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    setNewKeyword("");
    setCondField("");
    setCondValue("");
    setCondValue2("");
    load();
  };

  const [recatLoading, setRecatLoading] = useState(false);
  const [recatResult, setRecatResult] = useState("");

  const recategorizeAll = async () => {
    setRecatLoading(true);
    setRecatResult("");

    try {
      if (isCapacitor()) {
        const { initClientDb, recategorizeAllTransactions } = await import("@/lib/db-client");
        await initClientDb();
        const count = await recategorizeAllTransactions();
        setRecatResult(`Re-categorized ${count} transactions`);
      } else {
        const res = await fetch("/api/recategorize", { method: "POST" });
        const data = await res.json();
        setRecatResult(`Re-categorized ${data.recategorized} transactions`);
      }
    } catch (error) {
      console.error("Recategorize error:", error);
      setRecatResult(error instanceof Error ? error.message : "Recategorization failed");
    }

    setRecatLoading(false);
  };

  const exportRules = async () => {
    let data;
    if (isCapacitor()) {
      const { initClientDb, getCategories, getCategoryRules } = await import("@/lib/db-client");
      await initClientDb();
      const cats = await getCategories();
      const rls = await getCategoryRules();
      data = {
        categories: cats.map(c => ({ name: c.name, color: c.color, icon: c.icon, category_group: c.category_group })),
        rules: rls.map(r => ({
          category_name: r.category_name,
          keyword: r.keyword,
          priority: r.priority,
          condition_field: r.condition_field,
          condition_op: r.condition_op,
          condition_value: r.condition_value,
          condition_value2: r.condition_value2,
        })),
      };
    } else {
      const res = await fetch("/api/categories/rules/export");
      data = await res.json();
    }
    const content = JSON.stringify(data, null, 2);
    const success = await writeFileToDocuments("category-rules.json", content);
    if (success) {
      setRecatResult("Rules exported to category-rules.json");
    } else {
      setRecatResult("Export failed");
    }
  };

  const importRules = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        let result: { imported: number; skipped: number };
        if (isCapacitor()) {
          // Mobile: use client-side database
          const { initClientDb, importCategoryRules } = await import("@/lib/db-client");
          await initClientDb();
          result = await importCategoryRules(data.rules || [], data.categories || []);
        } else {
          // Desktop: use API route
          const res = await fetch("/api/categories/rules/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `HTTP ${res.status}`);
          }
          const json = await res.json();
          if (json.error) {
            throw new Error(json.error);
          }
          result = { imported: json.imported || 0, skipped: json.skipped || 0 };
        }
        setRecatResult(`Imported ${result.imported} rules, skipped ${result.skipped}`);
        load();
      } catch (err) {
        setRecatResult(err instanceof Error ? err.message : "Import failed");
      }
    };
    input.click();
  };

  const deleteRule = async (id: number) => {
    if (isCapacitor()) {
      const { initClientDb, deleteCategoryRule } = await import("@/lib/db-client");
      await initClientDb();
      await deleteCategoryRule(id);
    } else {
      await fetch("/api/categories/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    }
    load();
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setNewCatError("");

    if (isCapacitor()) {
      try {
        const { initClientDb, createCategory } = await import("@/lib/db-client");
        await initClientDb();
        await createCategory(newCatName.trim(), newCatColor, "tag", newCatGroup);
      } catch (err) {
        setNewCatError(err instanceof Error ? err.message : "Failed to create category");
        return;
      }
    } else {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim(), color: newCatColor, category_group: newCatGroup }),
      });
      if (!res.ok) {
        const data = await res.json();
        setNewCatError(data.error || "Failed to create category");
        return;
      }
    }

    setNewCatName("");
    setNewCatColor("#6b7280");
    setNewCatGroup("living_expenditure");
    load();
  };

  const startEditCategory = (c: Category) => {
    setEditingCatId(c.id);
    setEditCatName(c.name);
    setEditCatColor(c.color);
    setEditCatGroup(c.category_group || "other");
  };

  const cancelEditCategory = () => {
    setEditingCatId(null);
    setEditCatName("");
    setEditCatColor("");
    setEditCatGroup("other");
  };

  const saveEditCategory = async () => {
    if (editingCatId == null || !editCatName.trim()) return;
    const oldCat = categories.find(c => c.id === editingCatId);
    if (!oldCat) return;

    if (isCapacitor()) {
      const { initClientDb, updateCategory } = await import("@/lib/db-client");
      await initClientDb();
      await updateCategory(editingCatId, editCatName.trim(), editCatColor, oldCat.icon, editCatGroup, oldCat.name);
    } else {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingCatId, name: editCatName.trim(), color: editCatColor, category_group: editCatGroup }),
      });
      if (!res.ok) {
        const data = await res.json();
        setNewCatError(data.error || "Failed to update category");
        return;
      }
    }

    cancelEditCategory();
    load();
  };

  const startEdit = (r: Rule) => {
    setEditingId(r.id);
    setEditState({
      category_id: r.category_id,
      keyword: r.keyword ?? "",
      priority: r.priority,
      condField: r.condition_field ?? "",
      condOp: r.condition_op ?? "gt",
      condValue: r.condition_value != null ? String(r.condition_value) : "",
      condValue2: r.condition_value2 != null ? String(r.condition_value2) : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(null);
  };

  const saveEdit = async () => {
    if (!editState || editingId == null) return;

    if (isCapacitor()) {
      const { initClientDb, updateCategoryRule } = await import("@/lib/db-client");
      await initClientDb();
      await updateCategoryRule(editingId, {
        category_id: editState.category_id,
        keyword: editState.keyword || null,
        priority: editState.priority,
        condition_field: editState.condField || null,
        condition_op: editState.condField ? editState.condOp : null,
        condition_value: editState.condField && editState.condValue ? Number(editState.condValue) : null,
        condition_value2: editState.condField && editState.condOp === "between" && editState.condValue2 ? Number(editState.condValue2) : null,
      });
    } else {
      const body: Record<string, unknown> = {
        id: editingId,
        category_id: editState.category_id,
        keyword: editState.keyword || null,
        priority: editState.priority,
      };
      if (editState.condField && editState.condValue) {
        body.condition_field = editState.condField;
        body.condition_op = editState.condOp;
        body.condition_value = Number(editState.condValue);
        if (editState.condOp === "between" && editState.condValue2) {
          body.condition_value2 = Number(editState.condValue2);
        }
      }
      await fetch("/api/categories/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    cancelEdit();
    load();
  };

  const updateEdit = (field: keyof EditState, value: string | number) => {
    if (!editState) return;
    setEditState({ ...editState, [field]: value });
  };

  const inputCls = "border dark:border-gray-700 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200";
  const inputSmCls = "border dark:border-gray-700 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-200";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Categories & Rules</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportRules}
            className="flex items-center gap-1 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={importRules}
            className="flex items-center gap-1 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={recategorizeAll}
            disabled={recatLoading}
            className="flex items-center gap-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${recatLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{recatLoading ? "Processing..." : "Re-categorize"}</span>
          </button>
        </div>
      </div>

      {/* Status message */}
      {recatResult && (
        <div className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">{recatResult}</div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-3 sm:p-5 shadow-sm">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 text-sm sm:text-base">Add Rule</h2>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-end">
          <div className="col-span-1">
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Category</label>
            <select
              value={newCatId || ""}
              onChange={(e) => setNewCatId(Number(e.target.value))}
              className={`w-full ${inputCls}`}
            >
              {!newCatId && <option value="">Select category...</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-1 sm:flex-1 sm:min-w-[200px]">
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Keyword (narration match)</label>
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g. swiggy, uber, amazon"
              className={`w-full ${inputCls}`}
            />
          </div>
          <div className="col-span-2 sm:col-span-1 sm:w-20">
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Priority</label>
            <input
              type="number"
              value={newPriority}
              onChange={(e) => setNewPriority(Number(e.target.value))}
              className={`w-full ${inputCls}`}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-end mt-2 sm:mt-3">
          <div className="col-span-1">
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Condition</label>
            <select
              value={condField}
              onChange={(e) => setCondField(e.target.value)}
              className={`w-full ${inputCls}`}
            >
              <option value="">None</option>
              <option value="withdrawal">Debit</option>
              <option value="deposit">Credit</option>
            </select>
          </div>
          {condField && (
            <>
              <div className="col-span-1">
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Op</label>
                <select
                  value={condOp}
                  onChange={(e) => setCondOp(e.target.value)}
                  className={`w-full ${inputCls}`}
                >
                  {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{condOp === "between" ? "Min" : "Amt"}</label>
                <input
                  type="number"
                  value={condValue}
                  onChange={(e) => setCondValue(e.target.value)}
                  placeholder="500"
                  className={`w-full ${inputCls}`}
                />
              </div>
              {condOp === "between" && (
                <div className="col-span-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Max</label>
                  <input
                    type="number"
                    value={condValue2}
                    onChange={(e) => setCondValue2(e.target.value)}
                    placeholder="2000"
                    className={`w-full ${inputCls}`}
                  />
                </div>
              )}
            </>
          )}
          <label className="col-span-1 flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={applyExisting} onChange={(e) => setApplyExisting(e.target.checked)} />
            <span className="hidden sm:inline">Apply to existing</span>
            <span className="sm:hidden">Apply</span>
          </label>
          <button
            onClick={addRule}
            className="col-span-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1 hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 shadow-sm">
        <div className="px-5 py-3 border-b dark:border-gray-800">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">Active Rules ({rules.length})</h2>
        </div>
        <div className="divide-y dark:divide-gray-800 max-h-[600px] overflow-auto">
          {rules.map((r) =>
            editingId === r.id && editState ? (
              <div key={r.id} className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 space-y-2">
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Category</label>
                    <select
                      value={editState.category_id}
                      onChange={(e) => updateEdit("category_id", Number(e.target.value))}
                      className={inputSmCls}
                    >
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Keyword</label>
                    <input
                      type="text"
                      value={editState.keyword}
                      onChange={(e) => updateEdit("keyword", e.target.value)}
                      className={`w-full ${inputSmCls}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Priority</label>
                    <input
                      type="number"
                      value={editState.priority}
                      onChange={(e) => updateEdit("priority", Number(e.target.value))}
                      className={`${inputSmCls} w-16`}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Amount condition</label>
                    <select
                      value={editState.condField}
                      onChange={(e) => updateEdit("condField", e.target.value)}
                      className={inputSmCls}
                    >
                      <option value="">None</option>
                      <option value="withdrawal">Withdrawal</option>
                      <option value="deposit">Deposit</option>
                    </select>
                  </div>
                  {editState.condField && (
                    <>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Operator</label>
                        <select
                          value={editState.condOp}
                          onChange={(e) => updateEdit("condOp", e.target.value)}
                          className={inputSmCls}
                        >
                          {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{editState.condOp === "between" ? "Min" : "Amount"}</label>
                        <input
                          type="number"
                          value={editState.condValue}
                          onChange={(e) => updateEdit("condValue", e.target.value)}
                          className={`${inputSmCls} w-24`}
                        />
                      </div>
                      {editState.condOp === "between" && (
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Max</label>
                          <input
                            type="number"
                            value={editState.condValue2}
                            onChange={(e) => updateEdit("condValue2", e.target.value)}
                            className={`${inputSmCls} w-24`}
                          />
                        </div>
                      )}
                    </>
                  )}
                  <button onClick={saveEdit} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 p-1">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div key={r.id} className="flex items-center justify-between px-5 py-2.5">
                <div className="flex items-center gap-3">
                  <CategoryBadge category={r.category_name} />
                  {r.keyword && <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{r.keyword}</code>}
                  {r.condition_field && (
                    <code className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">{formatCondition(r)}</code>
                  )}
                  <span className="text-xs text-gray-400">{r.priority > 0 ? `priority: ${r.priority}` : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(r)} className="text-gray-400 hover:text-blue-500">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteRule(r.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 shadow-sm">
        <div className="px-5 py-3 border-b dark:border-gray-800">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">Categories</h2>
        </div>
        <div className="px-5 pt-4 pb-2 flex flex-wrap gap-3 items-end border-b dark:border-gray-800">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Name</label>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => { setNewCatName(e.target.value); setNewCatError(""); }}
              placeholder="e.g. Insurance"
              className={`w-full ${inputCls}`}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Color</label>
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="border dark:border-gray-700 rounded-lg w-10 h-9 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Group</label>
            <select
              value={newCatGroup}
              onChange={(e) => setNewCatGroup(e.target.value as CategoryGroup)}
              className={inputCls}
            >
              {CATEGORY_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <button
            onClick={addCategory}
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
          {newCatError && <span className="text-sm text-red-500 dark:text-red-400">{newCatError}</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-5">
          {categories.map((c) =>
            editingCatId === c.id ? (
              <div key={c.id} className="flex flex-wrap items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                <input
                  type="color"
                  value={editCatColor}
                  onChange={(e) => setEditCatColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  className={`flex-1 min-w-[100px] ${inputSmCls}`}
                  onKeyDown={(e) => e.key === "Enter" && saveEditCategory()}
                />
                <select
                  value={editCatGroup}
                  onChange={(e) => setEditCatGroup(e.target.value as CategoryGroup)}
                  className={inputSmCls}
                >
                  {CATEGORY_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
                <button onClick={saveEditCategory} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 p-1">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={cancelEditCategory} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div key={c.id} className="flex items-center gap-2 group hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg p-2 -m-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{c.name}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                  {CATEGORY_GROUPS.find(g => g.value === c.category_group)?.label || "Other"}
                </span>
                <button
                  onClick={() => startEditCategory(c)}
                  className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-800 shadow-sm">
        <div className="px-5 py-3 border-b border-red-200 dark:border-red-800">
          <h2 className="font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
        </div>
        <div className="p-5">
          {!showResetConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Reset all data</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Permanently delete all transactions, categories, and rules.</p>
              </div>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                <Trash2 className="w-4 h-4" /> Reset Data
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">This action cannot be undone.</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">All transactions, categories, and categorisation rules will be permanently deleted.</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Type <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">RESET</code> to confirm
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
                  className={`${inputCls} w-48`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (resetConfirmText !== "RESET") return;
                    if (isCapacitor()) {
                      const { initClientDb, resetAllData } = await import("@/lib/db-client");
                      await initClientDb();
                      await resetAllData();
                    } else {
                      await fetch("/api/reset", { method: "POST" });
                    }
                    setShowResetConfirm(false);
                    setResetConfirmText("");
                    load();
                  }}
                  disabled={resetConfirmText !== "RESET"}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Permanently Delete Everything
                </button>
                <button
                  onClick={() => { setShowResetConfirm(false); setResetConfirmText(""); }}
                  className="border dark:border-gray-700 text-gray-600 dark:text-gray-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

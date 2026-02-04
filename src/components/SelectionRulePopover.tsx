"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { isCapacitor } from "@/lib/platform";

type Category = { id: number; name: string; color: string };

export default function SelectionRulePopover({ onRuleAdded }: { onRuleAdded?: () => void }) {
  const [selection, setSelection] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catId, setCatId] = useState<number>(0);
  const [priority, setPriority] = useState(5);
  const [applyExisting, setApplyExisting] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showMobileInput, setShowMobileInput] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMobile = useRef(false);

  useEffect(() => {
    isMobile.current = isCapacitor();

    const loadCategories = async () => {
      if (isCapacitor()) {
        const { initClientDb, getCategories } = await import("@/lib/db-client");
        await initClientDb();
        const cats = await getCategories();
        setCategories(cats);
        if (cats.length) setCatId(cats[0].id);
      } else {
        fetch("/api/categories")
          .then((r) => r.json())
          .then((d) => {
            setCategories(d.categories);
            if (d.categories.length) setCatId(d.categories[0].id);
          });
      }
    };
    loadCategories();
  }, []);

  const expandedRef = useRef(false);
  expandedRef.current = expanded;

  const handleSelection = useCallback((e: MouseEvent | TouchEvent) => {
    if (popoverRef.current?.contains(e.target as Node)) return;
    if (expandedRef.current) {
      return;
    }

    const processSelection = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (text.length < 2) {
        setPos(null);
        setSelection("");
        setExpanded(false);
        return;
      }

      const range = sel?.getRangeAt(0);
      if (!range) return;
      const rect = range.getBoundingClientRect();
      setSelection(text);

      // On mobile, show a bottom floating button instead of inline popover
      // This avoids conflict with system selection menu
      if (isMobile.current) {
        setShowMobileInput(true);
        setPos(null);
      } else {
        setPos({ x: rect.left + rect.width / 2, y: rect.top - 8, below: false });
        setShowMobileInput(false);
      }
      setExpanded(false);
    };

    if (e.type === "touchend") {
      // Longer delay on mobile to let user interact with system menu first
      setTimeout(processSelection, 500);
    } else {
      processSelection();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("touchend", handleSelection);
    };
  }, [handleSelection]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      // Don't close on mobile if the mobile input is showing (handled by overlay)
      if (isMobile.current && showMobileInput) return;
      setPos(null);
      setSelection("");
      setExpanded(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMobileInput]);

  const addRule = async () => {
    if (isCapacitor()) {
      const { initClientDb, createCategoryRule, recategorizeAllTransactions } = await import("@/lib/db-client");
      await initClientDb();
      await createCategoryRule({
        category_id: catId,
        keyword: selection,
        priority,
        condition_field: null,
        condition_op: null,
        condition_value: null,
        condition_value2: null,
      });
      if (applyExisting) {
        await recategorizeAllTransactions();
      }
    } else {
      await fetch("/api/categories/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: catId,
          keyword: selection,
          priority,
          apply_existing: applyExisting,
        }),
      });
    }
    setPos(null);
    setSelection("");
    setExpanded(false);
    setShowMobileInput(false);
    window.getSelection()?.removeAllRanges();
    onRuleAdded?.();
  };

  const closeMobile = () => {
    setShowMobileInput(false);
    setSelection("");
    setExpanded(false);
    window.getSelection()?.removeAllRanges();
  };

  // Mobile: show bottom sheet style UI
  if (showMobileInput && selection) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/30" onClick={closeMobile}>
        <div
          ref={popoverRef}
          className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl p-4 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Create Rule</span>
            <button onClick={closeMobile} className="text-gray-400 text-xl leading-none">&times;</button>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Keyword: <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{selection.length > 40 ? selection.slice(0, 40) + "..." : selection}</code>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Category</label>
            <select
              value={catId}
              onChange={(e) => setCatId(Number(e.target.value))}
              className="w-full border dark:border-gray-700 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-800 dark:text-gray-200"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full border dark:border-gray-700 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 pb-2">
              <input
                type="checkbox"
                checked={applyExisting}
                onChange={(e) => setApplyExisting(e.target.checked)}
                className="w-4 h-4"
              />
              Apply to existing
            </label>
          </div>
          <button
            onClick={addRule}
            className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 rounded-lg text-base font-medium"
          >
            Add Rule
          </button>
        </div>
      </div>
    );
  }

  // Desktop: inline popover
  if (!pos || !selection) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl shadow-lg"
      style={{
        left: pos.x,
        top: pos.y,
        transform: pos.below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      }}
    >
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          Add &quot;{selection.length > 30 ? selection.slice(0, 30) + "..." : selection}&quot; as rule
        </button>
      ) : (
        <div className="p-3 space-y-2 min-w-[280px]">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Keyword: <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{selection}</code>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Category</label>
            <select
              value={catId}
              onChange={(e) => setCatId(Number(e.target.value))}
              className="w-full border dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full border dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 pb-1">
              <input
                type="checkbox"
                checked={applyExisting}
                onChange={(e) => setApplyExisting(e.target.checked)}
              />
              Apply to existing
            </label>
          </div>
          <button
            onClick={addRule}
            className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            Add Rule
          </button>
        </div>
      )}
    </div>
  );
}

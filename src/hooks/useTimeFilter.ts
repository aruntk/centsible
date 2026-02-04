"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

// Indian financial years: April to March
function getFYOptions(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options: { label: string; from: string; to: string }[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    options.push({
      label: `FY ${y}-${String(y + 1).slice(2)}`,
      from: `${y}-04-01`,
      to: `${y + 1}-03-31`,
    });
  }
  return options;
}

export const FY_OPTIONS = getFYOptions();

const STORAGE_KEY = "timeFilter";

function saveTo(preset: string, from: string, to: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, from, to }));
  } catch {}
}

function loadSaved(): { preset: string; from: string; to: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function computeDurationLabel(from: string, to: string): string {
  if (!from || !to) return "";
  const d1 = new Date(from);
  const d2 = new Date(to);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return "";

  let years = d2.getFullYear() - d1.getFullYear();
  let months = d2.getMonth() - d1.getMonth();
  let days = d2.getDate() - d1.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(d2.getFullYear(), d2.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const parts: string[] = [];
  if (years >= 1) {
    parts.push(`${years} year${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
  } else if (months >= 1) {
    parts.push(`${months} month${months > 1 ? "s" : ""}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  } else {
    const totalDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
    parts.push(`${totalDays} day${totalDays > 1 ? "s" : ""}`);
  }
  return parts.join(", ");
}

export function useTimeFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const preset = searchParams.get("preset") || loadSaved()?.preset || "all";
  const from = searchParams.get("from") || (preset === "custom" ? loadSaved()?.from || "" : "");
  const to = searchParams.get("to") || (preset === "custom" ? loadSaved()?.to || "" : "");

  const update = useCallback((newPreset: string, newFrom: string, newTo: string) => {
    saveTo(newPreset, newFrom, newTo);
    const sp = new URLSearchParams();
    sp.set("preset", newPreset);
    if (newPreset === "custom") {
      if (newFrom) sp.set("from", newFrom);
      if (newTo) sp.set("to", newTo);
    }
    router.replace(`${pathname}?${sp.toString()}`);
  }, [router, pathname]);

  const setPreset = useCallback((p: string) => {
    if (p === "custom") {
      update(p, from, to);
    } else {
      update(p, "", "");
    }
  }, [update, from, to]);

  const setFrom = useCallback((f: string) => update("custom", f, to), [update, to]);
  const setTo = useCallback((t: string) => update("custom", from, t), [update, from]);

  const apiParams = useMemo(() => {
    const params = new URLSearchParams();
    if (preset === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else if (preset !== "all") {
      const fy = FY_OPTIONS.find((f) => f.label === preset);
      if (fy) {
        params.set("from", fy.from);
        params.set("to", fy.to);
      }
    }
    return params;
  }, [preset, from, to]);

  const effectiveFrom = preset === "custom" ? from : (FY_OPTIONS.find(f => f.label === preset)?.from || "");
  const effectiveTo = preset === "custom" ? to : (FY_OPTIONS.find(f => f.label === preset)?.to || "");
  const durationLabel = preset !== "all" ? computeDurationLabel(effectiveFrom, effectiveTo) : "";

  return { preset, from, to, setPreset, setFrom, setTo, apiParams, durationLabel, effectiveFrom, effectiveTo };
}

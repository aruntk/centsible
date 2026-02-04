"use client";

import { FY_OPTIONS, useTimeFilter } from "@/hooks/useTimeFilter";

export default function TimeFilter() {
  const { preset, from, to, setPreset, setFrom, setTo, durationLabel } = useTimeFilter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
        className="border dark:border-gray-700 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 min-w-0"
      >
        <option value="all">All Time</option>
        {FY_OPTIONS.map((fy) => (
          <option key={fy.label} value={fy.label}>{fy.label}</option>
        ))}
        <option value="custom">Custom</option>
      </select>
      {preset === "custom" && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 w-32 sm:w-auto"
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 w-32 sm:w-auto"
          />
        </div>
      )}
      {durationLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">({durationLabel})</span>
      )}
    </div>
  );
}

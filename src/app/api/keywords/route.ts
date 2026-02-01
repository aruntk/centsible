import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  // Get merchants with counts (non-empty merchant field)
  const merchantRows = db.prepare(`
    SELECT merchant AS keyword, COUNT(*) AS count,
      GROUP_CONCAT(narration, '|||') AS narrations
    FROM transactions
    WHERE merchant != '' AND merchant IS NOT NULL
    GROUP BY merchant
    HAVING count >= 2
    ORDER BY count DESC
    LIMIT 200
  `).all() as { keyword: string; count: number; narrations: string }[];

  // Also extract common narration tokens (first word/token patterns)
  const tokenRows = db.prepare(`
    SELECT
      CASE
        WHEN narration LIKE 'UPI-%' THEN SUBSTR(narration, 5, INSTR(SUBSTR(narration, 5), '-') - 1)
        WHEN narration LIKE 'NEFT-%' THEN SUBSTR(narration, 6, INSTR(SUBSTR(narration, 6), '-') - 1)
        WHEN narration LIKE 'IMPS-%' THEN SUBSTR(narration, 6, INSTR(SUBSTR(narration, 6), '-') - 1)
        ELSE SUBSTR(narration, 1, INSTR(narration || ' ', ' ') - 1)
      END AS keyword,
      COUNT(*) AS count,
      GROUP_CONCAT(narration, '|||') AS narrations
    FROM transactions
    GROUP BY keyword
    HAVING count >= 3 AND LENGTH(keyword) >= 3
    ORDER BY count DESC
    LIMIT 200
  `).all() as { keyword: string; count: number; narrations: string }[];

  // Merge and deduplicate (merchants take priority)
  const seen = new Set<string>();
  const allKeywords: { keyword: string; count: number; samples: string[]; has_rule: boolean }[] = [];

  // Check which keywords already have rules
  const existingRules = db.prepare(
    "SELECT LOWER(keyword) AS kw FROM category_rules"
  ).all() as { kw: string }[];
  const ruleSet = new Set(existingRules.map((r) => r.kw));

  for (const rows of [merchantRows, tokenRows]) {
    for (const row of rows) {
      const key = row.keyword.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const narrationList = row.narrations.split("|||");
      const samples = narrationList.slice(0, 2);

      allKeywords.push({
        keyword: row.keyword.trim(),
        count: row.count,
        samples,
        has_rule: ruleSet.has(key),
      });
    }
  }

  // Sort by count descending
  allKeywords.sort((a, b) => b.count - a.count);

  return NextResponse.json({ keywords: allKeywords });
}

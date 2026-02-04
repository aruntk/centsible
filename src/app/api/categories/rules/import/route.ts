import { NextRequest, NextResponse } from "next/server";

const isMobileBuild = process.env.BUILD_TARGET === "mobile";

type ImportedCategory = {
  name: string;
  color?: string;
  icon?: string;
};

type ImportedRule = {
  category_name: string;
  keyword: string | null;
  priority: number;
  condition_field?: string | null;
  condition_op?: string | null;
  condition_value?: number | null;
  condition_value2?: number | null;
};

export async function POST(req: NextRequest) {
  if (isMobileBuild) {
    return NextResponse.json({ error: "Not available in mobile build" }, { status: 501 });
  }

  try {
    const body = await req.json();
    const importedRules = body.rules as ImportedRule[];
    const importedCategories = (body.categories ?? []) as ImportedCategory[];

    if (!Array.isArray(importedRules)) {
      return NextResponse.json({ error: "Invalid format: expected { rules: [...] }" }, { status: 400 });
    }

    const { getDb } = await import("@/lib/db");
    const db = getDb();

    // Create any missing categories from the export
    if (Array.isArray(importedCategories) && importedCategories.length > 0) {
      const insertCat = db.prepare(
        "INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)"
      );
      for (const cat of importedCategories) {
        if (cat.name?.trim()) {
          insertCat.run(cat.name.trim(), cat.color || "#6b7280", cat.icon || "tag");
        }
      }
    }

    const categories = db.prepare("SELECT id, name FROM categories").all() as { id: number; name: string }[];
    const catMap = new Map(categories.map((c) => [c.name, c.id]));

    let imported = 0;
    let skipped = 0;

    const insert = db.prepare(
      "INSERT INTO category_rules (category_id, keyword, priority, condition_field, condition_op, condition_value, condition_value2) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    const tx = db.transaction(() => {
      for (const rule of importedRules) {
        const catId = catMap.get(rule.category_name);
        if (!catId) {
          skipped++;
          continue;
        }

        // Check for duplicate
        const existing = db.prepare(
          "SELECT id FROM category_rules WHERE category_id = ? AND COALESCE(keyword, '') = ? AND COALESCE(condition_field, '') = ? AND COALESCE(condition_op, '') = ? AND COALESCE(condition_value, 0) = ?"
        ).get(catId, rule.keyword ?? "", rule.condition_field ?? "", rule.condition_op ?? "", rule.condition_value ?? 0);

        if (existing) {
          skipped++;
          continue;
        }

        insert.run(
          catId,
          rule.keyword || null,
          rule.priority ?? 5,
          rule.condition_field || null,
          rule.condition_op || null,
          rule.condition_value ?? null,
          rule.condition_value2 ?? null,
        );
        imported++;
      }
    });

    tx();

    return NextResponse.json({ imported, skipped });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed" }, { status: 500 });
  }
}

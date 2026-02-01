import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const categories = db.prepare(
    "SELECT name, color, icon FROM categories ORDER BY name"
  ).all() as { name: string; color: string; icon: string }[];

  const rules = db.prepare(`
    SELECT cr.keyword, cr.priority, cr.condition_field, cr.condition_op, cr.condition_value, cr.condition_value2,
           c.name AS category_name
    FROM category_rules cr
    JOIN categories c ON cr.category_id = c.id
    ORDER BY cr.priority DESC
  `).all();

  return NextResponse.json({ categories, rules }, {
    headers: {
      "Content-Disposition": "attachment; filename=category-rules.json",
    },
  });
}

import { NextResponse } from "next/server";
import { getDb, type Category, type CategoryRule } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const categories = db.prepare("SELECT * FROM categories ORDER BY name").all() as Category[];
  const rules = db.prepare(`
    SELECT cr.*, c.name as category_name
    FROM category_rules cr
    JOIN categories c ON cr.category_id = c.id
    ORDER BY cr.priority DESC
  `).all() as (CategoryRule & { category_name: string })[];

  return NextResponse.json({ categories, rules });
}

export async function POST(req: Request) {
  const { name, color, icon } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const db = getDb();
  const existing = db.prepare("SELECT id FROM categories WHERE name = ?").get(name.trim());
  if (existing) {
    return NextResponse.json({ error: "Category already exists" }, { status: 409 });
  }
  const result = db.prepare(
    "INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)"
  ).run(name.trim(), color || "#6b7280", icon || "tag");
  return NextResponse.json({ id: result.lastInsertRowid });
}

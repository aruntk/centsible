import { NextResponse } from "next/server";
import type { Category, CategoryRule } from "@/lib/db";
import { logger } from "@/lib/server-logger";

// For static export (mobile builds), mark as force-dynamic
// Mobile builds use direct database access via Capacitor, not API routes

const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export async function GET() {
  // Return empty response for static export - mobile uses direct DB access
  if (isMobileBuild) {
    return NextResponse.json({ categories: [], rules: [] });
  }

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const categories = db.prepare("SELECT * FROM categories ORDER BY name").all() as Category[];
  const rules = db.prepare(`
    SELECT cr.*, c.name as category_name
    FROM category_rules cr
    JOIN categories c ON cr.category_id = c.id
    ORDER BY cr.priority DESC
  `).all() as (CategoryRule & { category_name: string })[];

  logger.debug("categories", `Fetched ${categories.length} categories and ${rules.length} rules`);
  return NextResponse.json({ categories, rules });
}

export async function POST(req: Request) {
  // Not available during static export
  if (isMobileBuild) {
    return NextResponse.json({ error: "Not available in mobile build" }, { status: 501 });
  }

  const { name, color, icon, category_group } = await req.json();
  logger.info("categories", `Creating category: ${name}`);

  if (!name || !name.trim()) {
    logger.warn("categories", "Category name is required");
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const existing = db.prepare("SELECT id FROM categories WHERE name = ?").get(name.trim());
  if (existing) {
    logger.warn("categories", `Category already exists: ${name}`);
    return NextResponse.json({ error: "Category already exists" }, { status: 409 });
  }
  const result = db.prepare(
    "INSERT INTO categories (name, color, icon, category_group) VALUES (?, ?, ?, ?)"
  ).run(name.trim(), color || "#6b7280", icon || "tag", category_group || "other");
  logger.info("categories", `Created category id=${result.lastInsertRowid}: ${name}`);
  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PATCH(req: Request) {
  // Not available during static export
  if (isMobileBuild) {
    return NextResponse.json({ error: "Not available in mobile build" }, { status: 501 });
  }

  const { id, name, color, icon, category_group } = await req.json();
  logger.info("categories", `Updating category id=${id}: name=${name}, color=${color}, group=${category_group}`);

  if (!id) {
    return NextResponse.json({ error: "Category id is required" }, { status: 400 });
  }

  const { getDb } = await import("@/lib/db");
  const db = getDb();

  // Get current category to check if name changed
  const current = db.prepare("SELECT name FROM categories WHERE id = ?").get(id) as { name: string } | undefined;
  if (!current) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  // Check if new name already exists (if renaming)
  if (name && name.trim() !== current.name) {
    const existing = db.prepare("SELECT id FROM categories WHERE name = ? AND id != ?").get(name.trim(), id);
    if (existing) {
      logger.warn("categories", `Category name already exists: ${name}`);
      return NextResponse.json({ error: "Category name already exists" }, { status: 409 });
    }
  }

  // Update category
  const newName = name?.trim() || current.name;
  db.prepare("UPDATE categories SET name = ?, color = COALESCE(?, color), icon = COALESCE(?, icon), category_group = COALESCE(?, category_group) WHERE id = ?")
    .run(newName, color, icon, category_group, id);

  // Update transactions if name changed
  if (newName !== current.name) {
    const result = db.prepare("UPDATE transactions SET category = ? WHERE category = ?").run(newName, current.name);
    logger.info("categories", `Updated ${result.changes} transactions from "${current.name}" to "${newName}"`);
  }

  return NextResponse.json({ success: true });
}

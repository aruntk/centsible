import { NextResponse } from "next/server";
import type { Category, CategoryRule } from "@/lib/db";

// For static export (mobile builds), mark as force-static
// Mobile builds use direct database access via Capacitor, not API routes
export const dynamic = "force-static";

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

  return NextResponse.json({ categories, rules });
}

export async function POST(req: Request) {
  // Not available during static export
  if (isMobileBuild) {
    return NextResponse.json({ error: "Not available in mobile build" }, { status: 501 });
  }

  const { name, color, icon } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const { getDb } = await import("@/lib/db");
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

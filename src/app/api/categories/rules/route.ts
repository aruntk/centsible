import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    category_id, keyword, priority = 5, apply_existing = false,
    condition_field, condition_op, condition_value, condition_value2,
  } = body;

  if (!category_id) {
    return NextResponse.json({ error: "category_id required" }, { status: 400 });
  }
  if (!keyword && !condition_field) {
    return NextResponse.json({ error: "keyword or condition required" }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    "INSERT INTO category_rules (category_id, keyword, priority, condition_field, condition_op, condition_value, condition_value2) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(category_id, keyword || null, priority, condition_field || null, condition_op || null, condition_value ?? null, condition_value2 ?? null);

  if (apply_existing) {
    // Build query to find matching transactions
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (keyword) {
      conditions.push("(LOWER(narration) LIKE ? OR LOWER(merchant) LIKE ?)");
      const kw = `%${keyword.toLowerCase()}%`;
      params.push(kw, kw);
    }
    if (condition_field && condition_op && condition_value != null) {
      const col = condition_field === "withdrawal" ? "withdrawal" : "deposit";
      const opMap: Record<string, string> = { gt: ">", lt: "<", gte: ">=", lte: "<=", eq: "=" };
      const sqlOp = opMap[condition_op];
      if (condition_op === "between" && condition_value2 != null) {
        conditions.push(`${col} >= ? AND ${col} <= ?`);
        params.push(condition_value, condition_value2);
      } else if (sqlOp) {
        conditions.push(`${col} ${sqlOp} ?`);
        params.push(condition_value);
      }
    }

    if (conditions.length) {
      const where = conditions.join(" AND ");
      // Get the category name for direct update
      const cat = db.prepare("SELECT name FROM categories WHERE id = ?").get(category_id) as { name: string } | undefined;
      if (cat) {
        db.prepare(`UPDATE transactions SET category = ? WHERE ${where}`).run(cat.name, ...params);
      }
    }
  }

  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, category_id, keyword, priority, condition_field, condition_op, condition_value, condition_value2 } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(`
    UPDATE category_rules
    SET category_id = ?, keyword = ?, priority = ?, condition_field = ?, condition_op = ?, condition_value = ?, condition_value2 = ?
    WHERE id = ?
  `).run(category_id, keyword || null, priority ?? 5, condition_field || null, condition_op || null, condition_value ?? null, condition_value2 ?? null, id);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const db = getDb();
  db.prepare("DELETE FROM category_rules WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}

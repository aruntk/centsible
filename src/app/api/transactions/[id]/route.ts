import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (body.category !== undefined) {
    fields.push("category = ?");
    values.push(body.category);
  }
  if (body.merchant !== undefined) {
    fields.push("merchant = ?");
    values.push(body.merchant);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  values.push(parseInt(id));
  db.prepare(`UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  // Auto-create categorization rule when category is changed
  if (body.category) {
    const txn = db.prepare("SELECT narration, merchant FROM transactions WHERE id = ?")
      .get(parseInt(id)) as { narration: string; merchant: string } | undefined;

    if (txn) {
      // Use merchant if available, otherwise extract first meaningful token from narration
      const keyword = txn.merchant
        || extractKeyword(txn.narration);

      if (keyword) {
        const cat = db.prepare("SELECT id FROM categories WHERE name = ?")
          .get(body.category) as { id: number } | undefined;

        if (cat) {
          // Check if rule already exists for this keyword+category
          const existing = db.prepare(
            "SELECT id FROM category_rules WHERE LOWER(keyword) = ? AND category_id = ?"
          ).get(keyword.toLowerCase(), cat.id);

          if (!existing) {
            db.prepare(
              "INSERT INTO category_rules (category_id, keyword, priority) VALUES (?, ?, ?)"
            ).run(cat.id, keyword, 5);
          }
        }
      }
    }
  }

  const updated = db.prepare("SELECT * FROM transactions WHERE id = ?").get(parseInt(id));
  return NextResponse.json(updated);
}

function extractKeyword(narration: string): string {
  // UPI-<merchant>-...
  const upi = narration.match(/^UPI-([^-]+)/i);
  if (upi) return upi[1].trim();

  // NEFT CR-<ifsc>-<name>-...
  const neft = narration.match(/^NEFT CR-[^-]+-([^-]+)/i);
  if (neft) return neft[1].trim();

  // ACH D- <name>-...
  const ach = narration.match(/^ACH D-\s*([^-]+)/i);
  if (ach) return ach[1].trim();

  // IMPS-<name>-...
  const imps = narration.match(/^IMPS-([^-]+)/i);
  if (imps) return imps[1].trim();

  // Fallback: first word if long enough
  const first = narration.split(/[\s\-\/]+/)[0];
  if (first && first.length >= 3) return first;

  return "";
}

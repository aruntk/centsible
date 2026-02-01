import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseStatement } from "@/lib/parsers";
import { categorizeTransaction } from "@/lib/categorizer";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const { bank, transactions: parsed } = parseStatement(text, file.name);

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No transactions found in file" }, { status: 400 });
    }

    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO transactions (date, narration, ref_no, value_date, withdrawal, deposit, closing_balance, category, merchant)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Check for duplicates by ref_no
    const existingRefs = new Set(
      (db.prepare("SELECT ref_no FROM transactions").all() as { ref_no: string }[])
        .map((r) => r.ref_no)
    );

    let imported = 0;
    let skipped = 0;

    const tx = db.transaction(() => {
      for (const t of parsed) {
        if (t.ref_no && existingRefs.has(t.ref_no)) {
          skipped++;
          continue;
        }
        const { category, merchant } = categorizeTransaction(t.narration, t.withdrawal, t.deposit);
        insert.run(t.date, t.narration, t.ref_no, t.value_date, t.withdrawal, t.deposit, t.closing_balance, category, merchant);
        imported++;
      }
    });

    tx();

    return NextResponse.json({ imported, skipped, total: parsed.length, bank });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

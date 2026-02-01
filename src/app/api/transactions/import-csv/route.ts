import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { categorizeTransaction } from "@/lib/categorizer";
import { parseCSVLine } from "@/lib/parsers/utils";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

    const colMap: Record<string, number> = {};
    const aliases: Record<string, string[]> = {
      date: ["date", "txn date", "transaction date", "trans date"],
      narration: ["narration", "description", "particulars", "details", "remarks", "memo"],
      withdrawal: ["withdrawal", "debit", "withdrawal amt", "debit amount", "amount debited"],
      deposit: ["deposit", "credit", "deposit amt", "credit amount", "amount credited"],
      closing_balance: ["closing balance", "balance", "closing bal"],
      category: ["category", "cat"],
      merchant: ["merchant", "payee"],
      ref_no: ["ref no", "reference", "ref", "reference no", "cheque no", "chq no"],
    };

    for (const [field, names] of Object.entries(aliases)) {
      const idx = header.findIndex((h) => names.includes(h));
      if (idx !== -1) colMap[field] = idx;
    }

    if (!("date" in colMap) || !("narration" in colMap)) {
      return NextResponse.json(
        { error: "CSV must have at least 'Date' and 'Narration' columns" },
        { status: 400 }
      );
    }

    const db = getDb();
    const insert = db.prepare(
      `INSERT INTO transactions (date, narration, ref_no, value_date, withdrawal, deposit, closing_balance, category, merchant)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let imported = 0;
    let skipped = 0;

    const tx = db.transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const date = cols[colMap.date] ?? "";
        const narration = cols[colMap.narration] ?? "";
        if (!date || !narration) {
          skipped++;
          continue;
        }

        const withdrawal = colMap.withdrawal !== undefined ? parseFloat(cols[colMap.withdrawal]) || 0 : 0;
        const deposit = colMap.deposit !== undefined ? parseFloat(cols[colMap.deposit]) || 0 : 0;
        const closingBalance = colMap.closing_balance !== undefined ? parseFloat(cols[colMap.closing_balance]) || 0 : 0;
        const refNo = colMap.ref_no !== undefined ? cols[colMap.ref_no] || null : null;

        let category = colMap.category !== undefined ? cols[colMap.category] || "" : "";
        let merchant = colMap.merchant !== undefined ? cols[colMap.merchant] || "" : "";

        if (!category) {
          const auto = categorizeTransaction(narration, withdrawal, deposit);
          category = auto.category;
          if (!merchant) merchant = auto.merchant;
        }

        insert.run(date, narration, refNo, date, withdrawal, deposit, closingBalance, category, merchant);
        imported++;
      }
    });

    tx();

    return NextResponse.json({ imported, skipped, total: lines.length - 1 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

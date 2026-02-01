import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { categorizeAll } from "@/lib/categorizer";

export async function POST() {
  const db = getDb();
  const transactions = db.prepare(
    "SELECT id, narration, withdrawal, deposit FROM transactions"
  ).all() as { id: number; narration: string; withdrawal: number; deposit: number }[];

  categorizeAll(transactions);

  return NextResponse.json({ recategorized: transactions.length });
}

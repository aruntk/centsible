import { NextResponse } from "next/server";

export const dynamic = "force-static";

const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export async function POST() {
  if (isMobileBuild) {
    return NextResponse.json({ error: "Not available in mobile build" }, { status: 501 });
  }

  const { getDb } = await import("@/lib/db");
  const { categorizeAll } = await import("@/lib/categorizer");
  const db = getDb();
  const transactions = db.prepare(
    "SELECT id, narration, withdrawal, deposit FROM transactions"
  ).all() as { id: number; narration: string; withdrawal: number; deposit: number }[];

  categorizeAll(transactions);

  return NextResponse.json({ recategorized: transactions.length });
}

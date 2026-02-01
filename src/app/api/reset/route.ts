import { NextResponse } from "next/server";
import { getDb, seedDefaults } from "@/lib/db";

export async function POST() {
  const db = getDb();
  db.exec("DELETE FROM category_rules");
  db.exec("DELETE FROM transactions");
  db.exec("DELETE FROM categories");
  seedDefaults(db);
  return NextResponse.json({ success: true });
}

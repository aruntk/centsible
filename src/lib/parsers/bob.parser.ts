import { BankParser, ParsedTransaction } from "./types";
import { parseCSVLine, findHeaderRow, normalizeDate, parseAmount } from "./utils";

const REQUIRED_HEADERS = ["tran date", "particulars", "tran amount", "balance"];

export const bobParser: BankParser = {
  bankName: "Bank of Baroda",
  bankId: "bob",
  supportedFormats: ["csv"],

  detect(content: string, filename: string): number {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    const hasBob = /bank of baroda/i.test(content) || /\bbob\b/i.test(content) || /\bbob\b/i.test(filename);
    if (hasBob && headerIdx >= 0) return 0.85;
    if (headerIdx >= 0) return 0.5;
    if (hasBob) return 0.3;
    return 0;
  },

  parse(content: string): ParsedTransaction[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    if (headerIdx === -1) return [];

    const headers = parseCSVLine(lines[headerIdx]).map((h) => h.toLowerCase().trim());
    const col = (name: string) => headers.findIndex((h) => h.includes(name));

    const dateCol = col("tran date");
    const partCol = col("particulars");
    const amtCol = col("tran amount");
    const crdrCol = col("cr/dr");
    const balCol = col("balance");

    const transactions: ParsedTransaction[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const date = cols[dateCol]?.trim();
      if (!date || !/\d/.test(date)) continue;

      const amount = amtCol >= 0 ? parseAmount(cols[amtCol]) : 0;
      const indicator = crdrCol >= 0 ? cols[crdrCol]?.trim().toUpperCase() : "";
      const isCredit = indicator === "CR" || indicator === "C";

      transactions.push({
        date: normalizeDate(date),
        narration: cols[partCol]?.trim() ?? "",
        ref_no: "",
        value_date: normalizeDate(date),
        withdrawal: isCredit ? 0 : amount,
        deposit: isCredit ? amount : 0,
        closing_balance: balCol >= 0 ? parseAmount(cols[balCol]) : 0,
      });
    }
    return transactions;
  },
};

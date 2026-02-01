import { BankParser, ParsedTransaction } from "./types";
import { parseCSVLine, findHeaderRow, normalizeDate, parseAmount } from "./utils";

const REQUIRED_HEADERS = ["txn date", "description", "balance"];

export const sbiParser: BankParser = {
  bankName: "State Bank of India",
  bankId: "sbi",
  supportedFormats: ["csv"],

  detect(content: string, filename: string): number {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    const hasSbi = /state bank/i.test(content) || /\bsbi\b/i.test(content) || /\bsbi\b/i.test(filename);
    if (hasSbi && headerIdx >= 0) return 0.9;
    if (headerIdx >= 0) return 0.5;
    if (hasSbi) return 0.3;
    return 0;
  },

  parse(content: string): ParsedTransaction[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    if (headerIdx === -1) return [];

    const headers = parseCSVLine(lines[headerIdx]).map((h) => h.toLowerCase().trim());
    const col = (name: string) => headers.findIndex((h) => h.includes(name));

    const dateCol = col("txn date");
    const valDateCol = col("value date");
    const descCol = col("description");
    const refCol = col("ref no");
    const debitCol = col("debit");
    const creditCol = col("credit");
    const balCol = col("balance");

    const transactions: ParsedTransaction[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const date = cols[dateCol]?.trim();
      if (!date || !/\d/.test(date)) continue;

      transactions.push({
        date: normalizeDate(date),
        narration: cols[descCol]?.trim() ?? "",
        ref_no: refCol >= 0 ? cols[refCol]?.trim() ?? "" : "",
        value_date: valDateCol >= 0 ? normalizeDate(cols[valDateCol]?.trim() ?? date) : normalizeDate(date),
        withdrawal: debitCol >= 0 ? parseAmount(cols[debitCol]) : 0,
        deposit: creditCol >= 0 ? parseAmount(cols[creditCol]) : 0,
        closing_balance: balCol >= 0 ? parseAmount(cols[balCol]) : 0,
      });
    }
    return transactions;
  },
};

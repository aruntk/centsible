import { BankParser, ParsedTransaction } from "./types";
import { parseCSVLine, findHeaderRow, normalizeDate, parseAmount } from "./utils";

const REQUIRED_HEADERS = ["transaction date", "description", "debit", "credit", "balance"];

export const federalParser: BankParser = {
  bankName: "Federal Bank",
  bankId: "federal",
  supportedFormats: ["csv"],

  detect(content: string, filename: string): number {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    const hasFederal = /federal\s*bank/i.test(content) || /federal/i.test(filename);
    if (hasFederal && headerIdx >= 0) return 0.85;
    if (hasFederal) return 0.3;
    return 0;
  },

  parse(content: string): ParsedTransaction[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    if (headerIdx === -1) return [];

    const headers = parseCSVLine(lines[headerIdx]).map((h) => h.toLowerCase().trim());
    const col = (name: string) => headers.findIndex((h) => h.includes(name));

    const dateCol = col("transaction date");
    const descCol = col("description");
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
        ref_no: "",
        value_date: normalizeDate(date),
        withdrawal: debitCol >= 0 ? parseAmount(cols[debitCol]) : 0,
        deposit: creditCol >= 0 ? parseAmount(cols[creditCol]) : 0,
        closing_balance: balCol >= 0 ? parseAmount(cols[balCol]) : 0,
      });
    }
    return transactions;
  },
};

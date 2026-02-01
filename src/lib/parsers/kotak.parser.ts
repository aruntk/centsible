import { BankParser, ParsedTransaction } from "./types";
import { parseCSVLine, findHeaderRow, normalizeDate, parseAmount } from "./utils";

const REQUIRED_HEADERS = ["date", "description", "debit", "credit", "balance"];

export const kotakParser: BankParser = {
  bankName: "Kotak Mahindra Bank",
  bankId: "kotak",
  supportedFormats: ["csv"],

  detect(content: string, filename: string): number {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    const hasKotak = /kotak/i.test(content) || /kotak/i.test(filename);
    if (hasKotak && headerIdx >= 0) return 0.85;
    if (hasKotak) return 0.3;
    return 0;
  },

  parse(content: string): ParsedTransaction[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    if (headerIdx === -1) return [];

    const headers = parseCSVLine(lines[headerIdx]).map((h) => h.toLowerCase().trim());
    const col = (name: string) => headers.findIndex((h) => h.includes(name));

    const dateCol = col("date");
    const descCol = col("description");
    const refCol = col("chq");
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
        value_date: normalizeDate(date),
        withdrawal: debitCol >= 0 ? parseAmount(cols[debitCol]) : 0,
        deposit: creditCol >= 0 ? parseAmount(cols[creditCol]) : 0,
        closing_balance: balCol >= 0 ? parseAmount(cols[balCol]) : 0,
      });
    }
    return transactions;
  },
};

import { BankParser, ParsedTransaction } from "./types";
import { parseCSVLine, findHeaderRow, normalizeDate, parseAmount } from "./utils";

const REQUIRED_HEADERS = ["date", "narration", "closing balance"];

export const hdfcCsvParser: BankParser = {
  bankName: "HDFC Bank",
  bankId: "hdfc-csv",
  supportedFormats: ["csv"],

  detect(content: string, filename: string): number {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    if (headerIdx === -1) return 0;
    const hasHdfc = /hdfc/i.test(content) || /hdfc/i.test(filename);
    const headerLine = lines[headerIdx].toLowerCase();
    const hasNarration = headerLine.includes("narration");
    if (hasHdfc && hasNarration) return 0.85;
    if (hasNarration && headerLine.includes("chq")) return 0.7;
    return 0;
  },

  parse(content: string): ParsedTransaction[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    if (headerIdx === -1) return [];

    const headers = parseCSVLine(lines[headerIdx]).map((h) => h.toLowerCase().trim());
    const col = (name: string) => headers.findIndex((h) => h.includes(name));

    const dateCol = col("date");
    const narrCol = col("narration");
    const refCol = col("chq");
    const valDateCol = col("value dat");
    const wdCol = col("withdrawal");
    const depCol = col("deposit");
    const balCol = col("closing balance");

    const transactions: ParsedTransaction[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const date = cols[dateCol]?.trim();
      if (!date || !/\d/.test(date)) continue;

      transactions.push({
        date: normalizeDate(date),
        narration: cols[narrCol]?.trim() ?? "",
        ref_no: refCol >= 0 ? cols[refCol]?.trim() ?? "" : "",
        value_date: valDateCol >= 0 ? normalizeDate(cols[valDateCol]?.trim() ?? date) : normalizeDate(date),
        withdrawal: wdCol >= 0 ? parseAmount(cols[wdCol]) : 0,
        deposit: depCol >= 0 ? parseAmount(cols[depCol]) : 0,
        closing_balance: balCol >= 0 ? parseAmount(cols[balCol]) : 0,
      });
    }
    return transactions;
  },
};

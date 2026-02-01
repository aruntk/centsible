import { BankParser, ParsedTransaction } from "./types";
import { parseCSVLine, findHeaderRow, normalizeDate, parseAmount } from "./utils";

const REQUIRED_HEADERS = ["tran date", "particulars", "bal"];

export const axisParser: BankParser = {
  bankName: "Axis Bank",
  bankId: "axis",
  supportedFormats: ["csv"],

  detect(content: string, filename: string): number {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    const hasAxis = /axis/i.test(content) || /axis/i.test(filename);
    if (hasAxis && headerIdx >= 0) return 0.9;
    if (headerIdx >= 0) return 0.5;
    if (hasAxis) return 0.3;
    return 0;
  },

  parse(content: string): ParsedTransaction[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    if (headerIdx === -1) return [];

    const headers = parseCSVLine(lines[headerIdx]).map((h) => h.toLowerCase().trim());
    const col = (name: string) => headers.findIndex((h) => h.includes(name));

    const dateCol = col("tran date");
    const chqCol = col("chqno");
    const partCol = col("particulars");
    const drCol = col("dr amount");
    const crCol = col("cr amount");
    const balCol = col("bal");

    const transactions: ParsedTransaction[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const date = cols[dateCol]?.trim();
      if (!date || !/\d/.test(date)) continue;

      transactions.push({
        date: normalizeDate(date),
        narration: cols[partCol]?.trim() ?? "",
        ref_no: chqCol >= 0 ? cols[chqCol]?.trim() ?? "" : "",
        value_date: normalizeDate(date),
        withdrawal: drCol >= 0 ? parseAmount(cols[drCol]) : 0,
        deposit: crCol >= 0 ? parseAmount(cols[crCol]) : 0,
        closing_balance: balCol >= 0 ? parseAmount(cols[balCol]) : 0,
      });
    }
    return transactions;
  },
};

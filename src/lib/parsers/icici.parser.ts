import { BankParser, ParsedTransaction } from "./types";
import { parseCSVLine, findHeaderRow, normalizeDate, parseAmount } from "./utils";

const REQUIRED_HEADERS = ["transaction date", "transaction remarks", "balance"];

export const iciciParser: BankParser = {
  bankName: "ICICI Bank",
  bankId: "icici",
  supportedFormats: ["csv"],

  detect(content: string, filename: string): number {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    const hasIcici = /icici/i.test(content) || /icici/i.test(filename);
    if (hasIcici && headerIdx >= 0) return 0.9;
    if (headerIdx >= 0) return 0.5;
    if (hasIcici) return 0.3;
    return 0;
  },

  parse(content: string): ParsedTransaction[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const headerIdx = findHeaderRow(lines, REQUIRED_HEADERS);
    if (headerIdx === -1) return [];

    const headers = parseCSVLine(lines[headerIdx]).map((h) => h.toLowerCase().trim());
    const col = (name: string) => headers.findIndex((h) => h.includes(name));

    const txnDateCol = col("transaction date");
    const valDateCol = col("value date");
    const remarksCol = col("transaction remarks");
    const chqCol = col("cheque number");
    const wdCol = col("withdrawal amount");
    const depCol = col("deposit amount");
    const balCol = col("balance");

    const transactions: ParsedTransaction[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const date = cols[txnDateCol]?.trim();
      if (!date || !/\d/.test(date)) continue;

      transactions.push({
        date: normalizeDate(date),
        narration: cols[remarksCol]?.trim() ?? "",
        ref_no: chqCol >= 0 ? cols[chqCol]?.trim() ?? "" : "",
        value_date: valDateCol >= 0 ? normalizeDate(cols[valDateCol]?.trim() ?? date) : normalizeDate(date),
        withdrawal: wdCol >= 0 ? parseAmount(cols[wdCol]) : 0,
        deposit: depCol >= 0 ? parseAmount(cols[depCol]) : 0,
        closing_balance: balCol >= 0 ? parseAmount(cols[balCol]) : 0,
      });
    }
    return transactions;
  },
};

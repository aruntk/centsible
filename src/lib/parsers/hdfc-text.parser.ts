import { BankParser } from "./types";
import { parseHDFCStatement, ParsedTransaction } from "../parser";

export const hdfcTextParser: BankParser = {
  bankName: "HDFC Bank",
  bankId: "hdfc-text",
  supportedFormats: ["txt"],

  detect(content: string, filename: string): number {
    const hasHeader = content.includes("HDFC BANK Ltd.");
    const hasSeparators = content.includes("--------");
    if (hasHeader && hasSeparators) return 0.95;
    if (hasHeader) return 0.7;
    if (/hdfc/i.test(filename) && hasSeparators) return 0.6;
    return 0;
  },

  parse(content: string): ParsedTransaction[] {
    return parseHDFCStatement(content);
  },
};

import { BankParser, BankDetectionResult, ParsedTransaction } from "./types";
import { hdfcTextParser } from "./hdfc-text.parser";
import { hdfcCsvParser } from "./hdfc-csv.parser";
import { sbiParser } from "./sbi.parser";
import { iciciParser } from "./icici.parser";
import { axisParser } from "./axis.parser";
import { kotakParser } from "./kotak.parser";
import { yesBankParser } from "./yes-bank.parser";
import { pnbParser } from "./pnb.parser";
import { bobParser } from "./bob.parser";
import { federalParser } from "./federal.parser";

export type { BankParser, BankDetectionResult, ParsedTransaction };

const parsers: BankParser[] = [
  hdfcTextParser,
  hdfcCsvParser,
  sbiParser,
  iciciParser,
  axisParser,
  kotakParser,
  yesBankParser,
  pnbParser,
  bobParser,
  federalParser,
];

export function registerParser(parser: BankParser) {
  parsers.push(parser);
}

export function detectBank(content: string, filename: string): BankDetectionResult | null {
  let best: BankDetectionResult | null = null;
  for (const parser of parsers) {
    const confidence = parser.detect(content, filename);
    if (confidence > (best?.confidence ?? 0)) {
      best = { parser, confidence };
    }
  }
  return best && best.confidence >= 0.3 ? best : null;
}

export function parseStatement(
  content: string,
  filename: string
): { bank: string; transactions: ParsedTransaction[] } {
  const result = detectBank(content, filename);
  if (!result) {
    throw new Error(
      "Could not detect bank format. Please use the generic CSV import instead, or ensure your file is from a supported bank (HDFC, SBI, ICICI, Axis, Kotak, Yes Bank, PNB, Bank of Baroda, Federal Bank)."
    );
  }
  return {
    bank: result.parser.bankName,
    transactions: result.parser.parse(content),
  };
}

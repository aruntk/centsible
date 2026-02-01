export type { ParsedTransaction } from "../parser";

export interface BankParser {
  bankName: string;
  bankId: string;
  supportedFormats: ("txt" | "csv")[];
  detect(content: string, filename: string): number;
  parse(content: string): import("../parser").ParsedTransaction[];
}

export type BankDetectionResult = {
  parser: BankParser;
  confidence: number;
};

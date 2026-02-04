export type ParsedTransaction = {
  date: string;
  narration: string;
  ref_no: string;
  value_date: string;
  withdrawal: number;
  deposit: number;
  closing_balance: number;
};

const DATE_REGEX = /^\d{2}\/\d{2}\/\d{2}/;

function parseAmount(s: string): number {
  if (!s || !s.trim()) return 0;
  return parseFloat(s.trim().replace(/,/g, "")) || 0;
}

function parseDate(d: string): string {
  // Convert DD/MM/YY to YYYY-MM-DD
  const [day, month, year] = d.split("/");
  const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
  return `${fullYear}-${month}-${day}`;
}

export function parseHDFCStatement(text: string): ParsedTransaction[] {
  const lines = text.split("\n");
  const transactions: ParsedTransaction[] = [];
  let current: ParsedTransaction | null = null;
  let inDataSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of data section after the header separator
    if (line.startsWith("--------") && !inDataSection) {
      // Skip the next line if it's the column header
      const nextLine = lines[i + 1]?.trim();
      if (nextLine?.startsWith("Date") || nextLine?.startsWith("--------")) {
        continue;
      }
      inDataSection = true;
      continue;
    }

    const trimmed = line.trim();

    // Stop parsing at statement summary/footer
    if (line.includes("STATEMENT SUMMARY") || line.includes("Opening Balance") ||
        line.includes("computer generated statement") || line.includes("does not require") ||
        line.includes("considered correct") || line.includes("GSTIN number") ||
        /^\*{8,}/.test(trimmed) || line.includes("End Of Statement") ||
        line.includes("Generated On:") || line.includes("Registered Office")) {
      if (current) {
        transactions.push(current);
        current = null;
      }
      inDataSection = false;
      continue;
    }

    // Skip page headers, footers, and non-data lines
    if (line.includes("HDFC BANK Ltd.") || line.includes("Page No") ||
        line.includes("Statement of accounts") || line.includes("Account Branch") ||
        line.includes("Address") || line.includes("ARJU TOWER") ||
        line.includes("KRISHNALAYAM") || line.includes("CHITHAPPILE") ||
        line.includes("KANNUR 670502") || line.includes("KERALA") ||
        line.includes("JOINT HOLDERS") || line.includes("Nomination") ||
        line.includes("Statement From") || line.includes("Branch Code") ||
        line.includes("Account Type") || line.includes("Account No") ||
        line.includes("A/C Open Date") || line.includes("Account Status") ||
        line.includes("Cust ID") || line.includes("OD Limit") ||
        line.includes("Phone no.") || line.includes("Email") ||
        line.includes("RTGS/NEFT IFSC") || line.includes("City") ||
        line.includes("State") || line.includes("BANK ROAD") ||
        line.includes("MR.") || line.includes("Preferred Customer") ||
        line.trim() === "." || line.includes("**Continue**") ||
        line.includes("earmarked") || line.includes("includes funds")) {
      if (current && inDataSection) {
        transactions.push(current);
        current = null;
      }
      inDataSection = false;
      continue;
    }

    if (line.startsWith("--------")) {
      inDataSection = true;
      continue;
    }

    if (!inDataSection) continue;
    if (!trimmed) continue;

    // Check if this line starts a new transaction (starts with a date)
    if (DATE_REGEX.test(trimmed)) {
      // Save previous transaction
      if (current) {
        transactions.push(current);
      }

      // Parse the fixed-width columns
      // Date: cols 0-9, Narration: ~10-51, Ref: ~52-67, ValueDate: ~68-77, Withdrawal: ~78-95, Deposit: ~96-113, Balance: ~114+
      const dateStr = line.substring(0, 10).trim();
      const narration = line.substring(10, 52).trim();
      const refNo = line.substring(52, 68).trim();
      const valueDate = line.substring(68, 78).trim();
      const rest = line.substring(78);

      // Parse amounts from the rest - they are right-aligned in fixed columns
      // Withdrawal: 20 chars, Deposit: 20 chars, Balance: remaining
      const withdrawalStr = rest.substring(0, 20);
      const depositStr = rest.substring(20, 40);
      const balanceStr = rest.substring(40);

      current = {
        date: parseDate(dateStr),
        narration,
        ref_no: refNo,
        value_date: parseDate(valueDate),
        withdrawal: parseAmount(withdrawalStr),
        deposit: parseAmount(depositStr),
        closing_balance: parseAmount(balanceStr),
      };
    } else if (current) {
      // Continuation line - append to narration
      const contText = line.substring(10, 52).trim();
      if (contText && !/^\*{5,}/.test(contText)) {
        current.narration += " " + contText;
      }
    }
  }

  // Don't forget the last transaction
  if (current) {
    transactions.push(current);
  }

  return transactions;
}

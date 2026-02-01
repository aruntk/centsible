const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Normalize various Indian date formats to YYYY-MM-DD.
 * Supports: DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD MMM YYYY
 */
export function normalizeDate(d: string): string {
  const s = d.trim();

  // DD MMM YYYY (e.g. "01 Jan 2024")
  const mmmMatch = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (mmmMatch) {
    const day = mmmMatch[1].padStart(2, "0");
    const mon = MONTHS[mmmMatch[2].toLowerCase()];
    if (mon) return `${mmmMatch[3]}-${mon}-${day}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const fullMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (fullMatch) {
    const day = fullMatch[1].padStart(2, "0");
    const mon = fullMatch[2].padStart(2, "0");
    return `${fullMatch[3]}-${mon}-${day}`;
  }

  // DD/MM/YY
  const shortMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (shortMatch) {
    const day = shortMatch[1].padStart(2, "0");
    const mon = shortMatch[2].padStart(2, "0");
    const yr = parseInt(shortMatch[3]) > 50 ? `19${shortMatch[3]}` : `20${shortMatch[3]}`;
    return `${yr}-${mon}-${day}`;
  }

  return s;
}

/** Strip commas, parentheses, whitespace and parse as number. */
export function parseAmount(s: string): number {
  if (!s || !s.trim()) return 0;
  const cleaned = s.trim().replace(/,/g, "").replace(/[()]/g, "");
  return parseFloat(cleaned) || 0;
}

/** Parse a CSV line respecting quoted fields. */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Scan the first `maxLines` lines for a row containing all required columns.
 * Returns the 0-based line index or -1.
 */
export function findHeaderRow(lines: string[], requiredColumns: string[], maxLines = 20): number {
  const limit = Math.min(lines.length, maxLines);
  for (let i = 0; i < limit; i++) {
    const lower = lines[i].toLowerCase();
    if (requiredColumns.every((col) => lower.includes(col.toLowerCase()))) {
      return i;
    }
  }
  return -1;
}

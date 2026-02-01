import { getDb, type CategoryRule } from "./db";

type RuleWithCategory = CategoryRule & { category_name: string };

type TxContext = {
  narration: string;
  merchant?: string;
  withdrawal?: number;
  deposit?: number;
};

function ruleMatches(rule: RuleWithCategory, ctx: TxContext): boolean {
  // Keyword match (if specified) — checks narration and merchant
  if (rule.keyword) {
    const kw = rule.keyword.toLowerCase();
    const inNarration = ctx.narration.toLowerCase().includes(kw);
    const inMerchant = (ctx.merchant ?? "").toLowerCase().includes(kw);
    if (!inNarration && !inMerchant) return false;
  }

  // Amount condition match (if specified)
  if (rule.condition_field && rule.condition_op && rule.condition_value != null) {
    const fieldVal = rule.condition_field === "withdrawal" ? (ctx.withdrawal ?? 0) : (ctx.deposit ?? 0);
    switch (rule.condition_op) {
      case "gt": if (!(fieldVal > rule.condition_value)) return false; break;
      case "lt": if (!(fieldVal < rule.condition_value)) return false; break;
      case "gte": if (!(fieldVal >= rule.condition_value)) return false; break;
      case "lte": if (!(fieldVal <= rule.condition_value)) return false; break;
      case "eq": if (!(fieldVal === rule.condition_value)) return false; break;
      case "between":
        if (rule.condition_value2 == null) return false;
        if (!(fieldVal >= rule.condition_value && fieldVal <= rule.condition_value2)) return false;
        break;
      default: return false;
    }
  }

  // Must have at least one condition
  if (!rule.keyword && !rule.condition_field) return false;

  return true;
}

export function categorizeTransaction(narration: string, withdrawal?: number, deposit?: number): { category: string; merchant: string } {
  const db = getDb();
  const rules = db.prepare(`
    SELECT cr.*, c.name as category_name
    FROM category_rules cr
    JOIN categories c ON cr.category_id = c.id
    ORDER BY cr.priority DESC
  `).all() as RuleWithCategory[];

  const ctx: TxContext = { narration, withdrawal, deposit };
  let bestMatch: { category: string; priority: number } | null = null;

  for (const rule of rules) {
    if (ruleMatches(rule, ctx)) {
      if (!bestMatch || rule.priority > bestMatch.priority) {
        bestMatch = { category: rule.category_name, priority: rule.priority };
      }
    }
  }

  const merchant = extractMerchant(narration);
  return {
    category: bestMatch?.category ?? "Other",
    merchant,
  };
}

function extractMerchant(narration: string): string {
  const upiMatch = narration.match(/^UPI-([^-]+)/i);
  if (upiMatch) return cleanMerchantName(upiMatch[1]);

  const neftMatch = narration.match(/^NEFT CR-[^-]+-([^-]+)/i);
  if (neftMatch) return cleanMerchantName(neftMatch[1]);

  const achMatch = narration.match(/^ACH D-\s*([^-]+)/i);
  if (achMatch) return cleanMerchantName(achMatch[1]);

  const salaryMatch = narration.match(/^LOWES SALARY/i);
  if (salaryMatch) return "Lowes (Employer)";

  return "";
}

function cleanMerchantName(name: string): string {
  return name
    .replace(/\b(TECHNOLOGIES?|PRIVATE|LIMITED|PVT|LTD|SOLUTIONS?|P$)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function categorizeAll(transactions: { id: number; narration: string; withdrawal?: number; deposit?: number }[]) {
  const db = getDb();
  const update = db.prepare("UPDATE transactions SET category = ?, merchant = ? WHERE id = ?");

  const tx = db.transaction(() => {
    for (const t of transactions) {
      const { category, merchant } = categorizeTransaction(t.narration, t.withdrawal, t.deposit);
      update.run(category, merchant, t.id);
    }
  });

  tx();
}

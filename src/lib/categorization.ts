import { Transaction } from '@/types';

interface RuleLike {
  keyword: string;
  category: string;
}

export function suggestCategory(
  transactionName: string,
  rules: RuleLike[] = []
): string | null {
  const n = (transactionName || '').toUpperCase();
  const rule = rules.find((r) => n.includes(r.keyword.toUpperCase()));
  if (rule) return rule.category;

  const heuristics: [string, string][] = [
    ['POS', 'Food & groceries'],
    ['MARKET', 'Food & groceries'],
    ['CAFE', 'Coffee & snacks'],
    ['TAXI', 'Transport'],
    ['BILL', 'Bills'],
  ];

  const matched = heuristics.find(([k]) => n.includes(k));
  return matched ? matched[1] : null;
}

export function applyRulesToUncategorized(
  transactions: Transaction[],
  rules: RuleLike[]
): { updated: Transaction[]; count: number } {
  let count = 0;
  const updated = transactions.map((t) => {
    if (t.category === 'Uncategorized' && t.type === 'expense') {
      const suggested = suggestCategory(t.name, rules);
      if (suggested) {
        count++;
        return { ...t, category: suggested };
      }
    }
    return t;
  });
  return { updated, count };
}

import { Category } from '@/types';

/**
 * Shared helpers for the two-level category taxonomy.
 * Mains are ordered as returned (creation order); subs are grouped under their parent.
 */
export interface CategoryGroup {
  main: Category;
  subs: Category[];
}

export function buildCategoryGroups(categories: Category[]): CategoryGroup[] {
  const mains = categories.filter((c) => !c.parentId);
  const subs = categories.filter((c) => c.parentId);
  return mains.map((main) => ({
    main,
    subs: subs.filter((s) => s.parentId === main.id),
  }));
}

/** Display label for a transaction's category, including its parent when set. */
export function categoryLabel(t: {
  category: string;
  categoryParent?: string | null;
}): string {
  return t.categoryParent ? `${t.categoryParent} › ${t.category}` : t.category;
}

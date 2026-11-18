'use client';

import React from 'react';
import { Category } from '@/types';
import { buildCategoryGroups } from '@/lib/categories';

/**
 * Renders <option>/<optgroup> entries for the two-level category taxonomy.
 * Mains with subcategories become an optgroup; the main itself is the first
 * option (labelled "(all)" when `mainAllLabel`) so users can pick the whole
 * group or a specific sub.
 */
export const CategorySelectOptions: React.FC<{
  categories: Category[];
  mainAllLabel?: boolean;
}> = ({ categories, mainAllLabel = true }) => {
  const groups = buildCategoryGroups(categories);
  return (
    <>
      {groups.map(({ main, subs }) =>
        subs.length === 0 ? (
          <option key={main.id} value={main.name}>
            {main.icon} {main.name}
          </option>
        ) : (
          <optgroup key={main.id} label={`${main.icon} ${main.name}`}>
            <option value={main.name}>
              {main.name}
              {mainAllLabel ? ' (all)' : ''}
            </option>
            {subs.map((s) => (
              <option key={s.id} value={s.name}>
                {s.icon} {s.name}
              </option>
            ))}
          </optgroup>
        )
      )}
    </>
  );
};

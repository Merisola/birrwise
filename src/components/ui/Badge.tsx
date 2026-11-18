import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'category' | 'uncategorized' | 'count';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'category',
  className = '',
}) => {
  let cls = 'category-pill';
  if (variant === 'uncategorized') cls = 'category-pill unc';
  else if (variant === 'count') cls = 'count-badge';

  return <span className={`${cls} ${className}`.trim()}>{children}</span>;
};

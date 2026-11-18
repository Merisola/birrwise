import React, { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: 'default' | 'filter' | 'month' | 'budget-month' | 'settings';
}

export const Select: React.FC<SelectProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  let variantClass = '';
  if (variant === 'filter') variantClass = 'filter-control';
  else if (variant === 'month') variantClass = 'month-select';
  else if (variant === 'budget-month') variantClass = 'budget-month';
  else if (variant === 'settings') variantClass = 'settings-input';

  return (
    <select className={`${variantClass} ${className}`.trim()} {...props}>
      {children}
    </select>
  );
};

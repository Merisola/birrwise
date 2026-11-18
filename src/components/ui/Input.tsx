import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'search' | 'filter' | 'settings';
}

export const Input: React.FC<InputProps> = ({
  variant = 'default',
  className = '',
  ...props
}) => {
  let variantClass = '';
  if (variant === 'search') variantClass = 'search-control';
  else if (variant === 'filter') variantClass = 'filter-control';
  else if (variant === 'settings') variantClass = 'settings-input';

  return (
    <input
      className={`${variantClass} ${className}`.trim()}
      {...props}
    />
  );
};

import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'icon' | 'small' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  className = '',
  children,
  ...props
}) => {
  let variantClass = 'primary-btn';
  if (variant === 'secondary') variantClass = 'secondary-btn';
  if (variant === 'icon') variantClass = 'icon-btn';
  if (variant === 'small') variantClass = 'small-action';
  if (variant === 'danger') variantClass = 'small-action danger';

  return (
    <button className={`${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
};

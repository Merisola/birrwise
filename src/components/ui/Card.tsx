import React, { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'panel' | 'account' | 'budget' | 'manage';
}

export const Card: React.FC<CardProps> = ({
  variant = 'panel',
  className = '',
  children,
  ...props
}) => {
  let cls = 'panel';
  if (variant === 'account') cls = 'account';
  else if (variant === 'budget') cls = 'budget-card';
  else if (variant === 'manage') cls = 'manage-card';

  return (
    <div className={`${cls} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

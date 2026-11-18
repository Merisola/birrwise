import React, { ButtonHTMLAttributes } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  suggested?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  selected = false,
  suggested = false,
  className = '',
  children,
  ...props
}) => {
  let cls = 'chip';
  if (selected) cls += ' sel';
  if (suggested) cls += ' sug';

  return (
    <button className={`${cls} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
};

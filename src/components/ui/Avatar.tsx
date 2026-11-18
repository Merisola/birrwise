import React from 'react';

interface AvatarProps {
  children: React.ReactNode;
  variant?: 'avatar' | 'bank' | 'merchant';
  bankClass?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Avatar: React.FC<AvatarProps> = ({
  children,
  variant = 'merchant',
  bankClass = '',
  className = '',
  style,
}) => {
  let cls = 'merchant-icon';
  if (variant === 'avatar') cls = 'avatar';
  else if (variant === 'bank') cls = `bank-icon ${bankClass}`.trim();

  return (
    <div className={`${cls} ${className}`.trim()} style={style}>
      {children}
    </div>
  );
};

import React from 'react';


export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'secondary'
    | 'error'
    | string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const getVariantStyles = (variantType: string) => {
  switch (variantType) {
    case 'success':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';

    case 'danger':
    case 'error':
      return 'bg-rose-50 text-rose-700 border-rose-200';

    case 'warning':
      return 'bg-amber-50 text-amber-700 border-amber-200';

    case 'info':
      return 'bg-blue-50 text-blue-700 border-blue-200';

    case 'secondary':
      return 'bg-purple-50 text-purple-700 border-purple-200';

    case 'default':
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

const getSizeStyles = (sizeType: string) => {
  switch (sizeType) {
    case 'sm':
      return 'px-2 py-0.5 text-xs';

    case 'lg':
      return 'px-3.5 py-1.5 text-sm';

    case 'md':
    default:
      return 'px-2.5 py-1 text-xs';
  }
};

export function Badge({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${getVariantStyles(
        variant
      )} ${getSizeStyles(size)} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
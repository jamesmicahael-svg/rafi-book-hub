import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/utils';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  children: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', block, className, children, ...rest }: Props) {
  return (
    <button
      className={cx(
        'btn',
        variant !== 'primary' && `btn-${variant}`,
        size !== 'md' && `btn-${size}`,
        block && 'btn-block',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

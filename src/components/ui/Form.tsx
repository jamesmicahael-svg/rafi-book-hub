import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | null };
export function Input({ label, error, className, id, ...rest }: InputProps) {
  return (
    <div className="field">
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <input className={cx('input', className)} id={id} {...rest} />
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string | null };
export function Textarea({ label, error, className, id, ...rest }: TextareaProps) {
  return (
    <div className="field">
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <textarea className={cx('textarea', className)} id={id} {...rest} />
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string | null; children: ReactNode };
export function Select({ label, error, className, id, children, ...rest }: SelectProps) {
  return (
    <div className="field">
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <select className={cx('select', className)} id={id} {...rest}>{children}</select>
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

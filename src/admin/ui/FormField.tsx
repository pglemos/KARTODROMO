import type { PropsWithChildren, ReactNode } from 'react';

type FormFieldProps = PropsWithChildren<{
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
}>;

export const FormField = ({ children, error, hint, htmlFor, label }: FormFieldProps) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-zinc-400" htmlFor={htmlFor}>
      {label}
    </label>
    {children}
    {error ? (
      <p className="mt-1.5 text-xs text-red-400" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
    ) : null}
  </div>
);

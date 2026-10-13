import type { PropsWithChildren, ReactNode } from 'react';

type FormFieldProps = PropsWithChildren<{
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
}>;

export const FormField = ({ children, error, hint, htmlFor, label }: FormFieldProps) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-kib-texto-2" htmlFor={htmlFor}>
      {label}
    </label>
    {children}
    {error ? (
      <p className="mt-1.5 text-xs text-kib-perigo" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="mt-1.5 text-xs text-kib-texto-3">{hint}</p>
    ) : null}
  </div>
);

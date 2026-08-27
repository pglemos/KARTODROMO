import { cloneElement, isValidElement, useId, type PropsWithChildren, type ReactElement, type ReactNode } from 'react';

type FormFieldProps = PropsWithChildren<{
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
}>;

export const FormField = ({ children, error, hint, htmlFor, label }: FormFieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, !error && hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  const field = htmlFor && isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
      })
    : children;

  return (
    <div className="admin-form-field">
      <label className="mb-1.5 block text-xs font-semibold text-zinc-400" htmlFor={htmlFor}>
        {label}
      </label>
      {field}
      {error ? (
        <p className="admin-field-error mt-1.5 text-xs" id={errorId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="admin-field-hint mt-1.5 text-xs" id={hintId}>{hint}</p>
      ) : null}
    </div>
  );
};

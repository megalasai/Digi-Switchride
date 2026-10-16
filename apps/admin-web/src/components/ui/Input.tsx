import { cn } from "@/lib/cn";

export function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-text-secondary">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted",
        "focus:outline-none focus:ring-2",
        invalid
          ? "border-danger focus:border-danger focus:ring-danger/20"
          : "border-border focus:border-brand focus:ring-brand/20",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-text-primary",
        "focus:outline-none focus:ring-2",
        invalid
          ? "border-danger focus:border-danger focus:ring-danger/20"
          : "border-border focus:border-brand focus:ring-brand/20",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

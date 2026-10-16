import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark shadow-[0_8px_18px_rgba(91,124,250,0.28)]",
  secondary: "bg-white text-text-primary border border-border hover:bg-brand-light/60 shadow-sm",
  danger: "bg-danger text-white hover:brightness-95 shadow-sm",
  ghost: "text-text-secondary hover:bg-brand-light hover:text-brand-dark",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

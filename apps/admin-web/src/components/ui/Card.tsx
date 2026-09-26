import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface-card shadow-sm", className)}>
      {children}
    </div>
  );
}

export function FormPanel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("mb-6 p-6", className)}>
      {title && <h2 className="mb-4 text-base font-semibold text-text-primary">{title}</h2>}
      {children}
    </Card>
  );
}

import { cn } from "@/lib/cn";

export function Card({ className, children, id }: { className?: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className={cn("rounded-2xl border border-border bg-surface-card shadow-[0_10px_30px_rgba(22,25,43,0.04)]", className)}>
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

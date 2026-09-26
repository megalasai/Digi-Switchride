import { cn } from "@/lib/cn";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  icon,
  accent = "brand",
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: "brand" | "blue" | "amber" | "slate";
  className?: string;
}) {
  const accents = {
    brand: "bg-brand-light text-brand-dark",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-secondary">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-text-primary">{value}</p>
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accents[accent])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

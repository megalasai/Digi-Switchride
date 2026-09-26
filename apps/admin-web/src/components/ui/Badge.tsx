import { cn } from "@/lib/cn";

const variants: Record<string, string> = {
  Approved: "bg-brand-light text-brand-dark",
  Active: "bg-brand-light text-brand-dark",
  InProgress: "bg-brand-light text-brand-dark",
  Available: "bg-brand-light text-brand-dark",
  Connected: "bg-brand-light text-brand-dark",
  Pending: "bg-amber-50 text-amber-700",
  UnderReview: "bg-blue-50 text-blue-700",
  Rejected: "bg-red-50 text-red-700",
  Cancelled: "bg-red-50 text-red-700",
  InRide: "bg-blue-50 text-blue-700",
  Maintenance: "bg-orange-50 text-orange-700",
  Offline: "bg-slate-100 text-slate-600",
  NotSubmitted: "bg-slate-100 text-slate-600",
  Inactive: "bg-slate-100 text-slate-600",
  Confirmed: "bg-brand-light text-brand-dark",
  Completed: "bg-slate-100 text-slate-700",
};

export function Badge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variants[status] ?? "bg-slate-100 text-slate-600",
        className,
      )}
    >
      {status}
    </span>
  );
}

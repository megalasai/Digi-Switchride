import { cn } from "@/lib/cn";

export function Alert({ variant = "error", message }: { variant?: "error" | "success"; message: string }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 text-sm font-medium",
        variant === "error" ? "bg-red-50 text-red-700" : "bg-brand-light text-brand-dark",
      )}
    >
      {message}
    </div>
  );
}

import { createElement } from "react";

export type WheelClass = "TwoWheeler" | "ThreeWheeler" | "FourWheeler";
export type AssetKind = "scooter" | "bike" | "rickshaw" | "car" | "truck";
export type MotionKind = "moving" | "idle" | "stale" | "stopped" | "immobilised";

export const MOTION_COLORS: Record<MotionKind, string> = {
  moving: "#16a34a",
  idle: "#d97706",
  stale: "#64748b",
  stopped: "#2563eb",
  immobilised: "#dc2626",
};

export const RIDER_RING = "#7c3aed";
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const MOVING_KMH = 3;

export function resolveWheelClass(type?: string | null, wheelClass?: string | null): WheelClass {
  if (wheelClass === "TwoWheeler" || wheelClass === "ThreeWheeler" || wheelClass === "FourWheeler") return wheelClass;
  if (type === "ERickshaw") return "ThreeWheeler";
  if (type === "ECar" || type === "ETruck") return "FourWheeler";
  return "TwoWheeler";
}

export function wheelClassFromType(type: string): WheelClass {
  return resolveWheelClass(type);
}

export const WHEEL_CLASS_LABEL: Record<WheelClass, string> = {
  TwoWheeler: "2-wheeler",
  ThreeWheeler: "3-wheeler",
  FourWheeler: "4-wheeler",
};

export const ASSET_TYPE_LABEL: Record<string, string> = {
  EScooter: "E-scooter",
  EBike: "E-bike",
  ERickshaw: "Auto rickshaw",
  ECar: "Car",
  ETruck: "Truck",
};

export function resolveAssetKind(type?: string | null, wheelClass?: string | null): AssetKind {
  const t = (type ?? "").toLowerCase();
  if (t.includes("truck") || t.includes("lorry") || t.includes("pickup") || type === "ETruck") return "truck";
  if (t.includes("rick") || t.includes("auto") || type === "ERickshaw" || wheelClass === "ThreeWheeler") return "rickshaw";
  if (t.includes("car") || t.includes("suv") || type === "ECar") return "car";
  if (t.includes("scoot") || type === "EScooter") return "scooter";
  if (t.includes("bike") || t.includes("moto") || type === "EBike") return "bike";
  if (wheelClass === "FourWheeler") return "car";
  return "scooter";
}

export function assetTypeLabel(type?: string | null, wheelClass?: string | null) {
  if (type && ASSET_TYPE_LABEL[type]) return ASSET_TYPE_LABEL[type];
  const kind = resolveAssetKind(type, wheelClass);
  if (kind === "truck") return "Truck";
  if (kind === "car") return "Car";
  if (kind === "rickshaw") return "Auto rickshaw";
  if (kind === "bike") return "E-bike";
  return "E-scooter";
}

export function isIgnitionOn(ignition?: string | null) {
  const value = (ignition ?? "").toString().trim().toLowerCase();
  return value === "on" || value === "1" || value === "true" || value === "acc on";
}

export function resolveMotion(opts: {
  speedKmh?: number | null;
  ignition?: string | null;
  lastTelemetryAt?: string | Date | null;
  immobilised?: boolean | null;
}): { kind: MotionKind; color: string; label: string } {
  if (opts.immobilised) return { kind: "immobilised", color: MOTION_COLORS.immobilised, label: "Immobilised" };
  const at = opts.lastTelemetryAt ? new Date(opts.lastTelemetryAt).getTime() : NaN;
  if (!Number.isFinite(at) || Date.now() - at > STALE_AFTER_MS) {
    return { kind: "stale", color: MOTION_COLORS.stale, label: "No data > 2 hrs" };
  }
  if ((opts.speedKmh ?? 0) >= MOVING_KMH) return { kind: "moving", color: MOTION_COLORS.moving, label: "Moving" };
  if (isIgnitionOn(opts.ignition)) return { kind: "idle", color: MOTION_COLORS.idle, label: "Idle (ignition on)" };
  return { kind: "stopped", color: MOTION_COLORS.stopped, label: "Stopped" };
}

function silhouette(kind: AssetKind, color: string) {
  if (kind === "truck") {
    return `
      <path d="M10 27.5h16.5v-9.5H22l-2.2-5H10v14.5z" fill="${color}"/>
      <path d="M26.5 22.5h8.2l3.3 5v4.5h-11.5v-9.5z" fill="${color}"/>
      <rect x="12.2" y="15.2" width="6.6" height="4.2" rx="0.7" fill="#e8f4ff"/>
      <rect x="28.2" y="24.2" width="4.2" height="3" rx="0.5" fill="#e8f4ff"/>
      <circle cx="16" cy="32.4" r="3.1" fill="#1a1d2e"/>
      <circle cx="16" cy="32.4" r="1.15" fill="#dbe4f0"/>
      <circle cx="33.2" cy="32.4" r="3.1" fill="#1a1d2e"/>
      <circle cx="33.2" cy="32.4" r="1.15" fill="#dbe4f0"/>`;
  }
  if (kind === "car") {
    return `
      <path d="M11 29.5h26l-.8-7.2-4.6-6.3H18.2L13.2 22.3 11 29.5z" fill="${color}"/>
      <path d="M18.6 16.6h10.6l3.5 5.4H15.2l3.4-5.4z" fill="#e8f4ff"/>
      <path d="M23.2 16.6v5.4" stroke="${color}" stroke-width="1" opacity=".35"/>
      <circle cx="17.2" cy="32.3" r="3.15" fill="#1a1d2e"/>
      <circle cx="17.2" cy="32.3" r="1.15" fill="#dbe4f0"/>
      <circle cx="31.2" cy="32.3" r="3.15" fill="#1a1d2e"/>
      <circle cx="31.2" cy="32.3" r="1.15" fill="#dbe4f0"/>`;
  }
  if (kind === "rickshaw") {
    return `
      <path d="M22 16.5h11.5c1.4 0 2.5 1.2 2.5 2.7v10.3H22V16.5z" fill="${color}"/>
      <path d="M24.2 18.2h7.4v4.6H24.2z" fill="#e8f4ff"/>
      <path d="M11.5 24.2 22 16.8v12.7H14.2c-1.6 0-2.7-1.4-2.7-3.1v-2.2z" fill="${color}"/>
      <circle cx="17.4" cy="32.6" r="3.05" fill="#1a1d2e"/>
      <circle cx="17.4" cy="32.6" r="1.1" fill="#dbe4f0"/>
      <circle cx="32.4" cy="32.6" r="3.05" fill="#1a1d2e"/>
      <circle cx="32.4" cy="32.6" r="1.1" fill="#dbe4f0"/>
      <circle cx="24.8" cy="32.6" r="2.35" fill="#1a1d2e"/>`;
  }
  if (kind === "bike") {
    return `
      <path d="M20.5 20.2h9.2l2.6 6.4h-6.4l-2.4 5.2h-4.1l1.1-11.6z" fill="${color}"/>
      <path d="M29.4 20.4 33 14.8h2.1" stroke="${color}" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M21.4 20.6 17.2 15.2" stroke="${color}" stroke-width="2.1" stroke-linecap="round"/>
      <circle cx="16.4" cy="32.5" r="3.3" fill="#1a1d2e"/>
      <circle cx="16.4" cy="32.5" r="1.2" fill="#dbe4f0"/>
      <circle cx="32.6" cy="32.5" r="3.3" fill="#1a1d2e"/>
      <circle cx="32.6" cy="32.5" r="1.2" fill="#dbe4f0"/>`;
  }
  return `
    <path d="M15.5 24.8h14.6c.7 0 1.2.6 1.1 1.3l-.6 4.6H16.4l-.9-5.9z" fill="${color}"/>
    <path d="M19.2 24.8 22.4 16h4.8l3.4 8.8" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" fill="none"/>
    <path d="M21.8 16.2h6.6" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="17.2" cy="32.6" r="3.15" fill="#1a1d2e"/>
    <circle cx="17.2" cy="32.6" r="1.15" fill="#dbe4f0"/>
    <circle cx="31.4" cy="32.6" r="3.15" fill="#1a1d2e"/>
    <circle cx="31.4" cy="32.6" r="1.15" fill="#dbe4f0"/>`;
}

export function vehicleMarkerSvg(
  wheelClassOrKind: WheelClass | AssetKind,
  color = "#0f6e56",
  opts?: { withRider?: boolean; kind?: AssetKind; type?: string | null },
) {
  const kind =
    opts?.kind ??
    (wheelClassOrKind === "scooter" ||
    wheelClassOrKind === "bike" ||
    wheelClassOrKind === "rickshaw" ||
    wheelClassOrKind === "car" ||
    wheelClassOrKind === "truck"
      ? wheelClassOrKind
      : resolveAssetKind(opts?.type, wheelClassOrKind as WheelClass));
  const ring = opts?.withRider
    ? `<circle cx="24" cy="24" r="22.6" fill="none" stroke="${RIDER_RING}" stroke-width="3.2"/>`
    : "";
  return `<svg viewBox="0 0 48 48" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      ${ring}
      <circle cx="24" cy="24" r="${opts?.withRider ? "19.2" : "21.2"}" fill="white" stroke="${color}" stroke-width="3"/>
      ${silhouette(kind, color)}
    </svg>`;
}

export function VehicleGlyph({
  type,
  wheelClass,
  color,
  withRider,
  className,
  title,
}: {
  type?: string | null;
  wheelClass?: string | null;
  color?: string;
  withRider?: boolean;
  className?: string;
  title?: string;
}) {
  const kind = resolveAssetKind(type, wheelClass);
  return createElement("span", {
    className: className ?? "inline-flex h-9 w-9 shrink-0",
    title: title ?? assetTypeLabel(type, wheelClass),
    dangerouslySetInnerHTML: {
      __html: vehicleMarkerSvg(kind, color ?? "#0f6e56", { withRider, kind }),
    },
  });
}

export function FleetMotionLegend({ className }: { className?: string }) {
  const items: { color: string; label: string; ring?: boolean }[] = [
    { color: MOTION_COLORS.moving, label: "Moving" },
    { color: MOTION_COLORS.idle, label: "Idle · ignition on" },
    { color: MOTION_COLORS.stopped, label: "Stopped" },
    { color: MOTION_COLORS.stale, label: "No data > 2 hrs" },
    { color: RIDER_RING, label: "On trip with rider", ring: true },
  ];
  return createElement(
    "div",
    { className: className ?? "flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted" },
    ...items.map((item) =>
      createElement(
        "span",
        { key: item.label, className: "inline-flex items-center gap-1.5" },
        createElement("span", {
          className: "h-2.5 w-2.5 rounded-full",
          style: item.ring
            ? { boxShadow: `0 0 0 2px ${item.color}`, background: "white" }
            : { background: item.color },
        }),
        item.label,
      ),
    ),
  );
}

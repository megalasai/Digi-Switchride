export type WheelClass = "TwoWheeler" | "ThreeWheeler" | "FourWheeler";

export function resolveWheelClass(type?: string | null, wheelClass?: string | null): WheelClass {
  if (wheelClass === "TwoWheeler" || wheelClass === "ThreeWheeler" || wheelClass === "FourWheeler") return wheelClass;
  if (type === "ERickshaw") return "ThreeWheeler";
  if (type === "ECar") return "FourWheeler";
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
  ERickshaw: "E-rickshaw",
  ECar: "Car",
};

export function assetTypeLabel(type?: string | null, wheelClass?: string | null) {
  if (type && ASSET_TYPE_LABEL[type]) return ASSET_TYPE_LABEL[type];
  if (wheelClass === "FourWheeler") return "Car";
  if (wheelClass === "ThreeWheeler") return "E-rickshaw";
  if (wheelClass === "TwoWheeler") return "Bike";
  return type || "Vehicle";
}

export function vehicleMarkerSvg(wheelClass: WheelClass, color = "#0f6e56") {
  if (wheelClass === "FourWheeler") {
    return `<svg viewBox="0 0 48 48" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="22" fill="white" stroke="${color}" stroke-width="3"/>
      <path d="M12 28h24l-2-8h-8l-3-4h-6l-3 4h-4l2 8z" fill="${color}"/>
      <circle cx="17" cy="30" r="3" fill="#1a1d2e"/><circle cx="31" cy="30" r="3" fill="#1a1d2e"/>
    </svg>`;
  }
  if (wheelClass === "ThreeWheeler") {
    return `<svg viewBox="0 0 48 48" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="22" fill="white" stroke="${color}" stroke-width="3"/>
      <path d="M16 30h16l-1-8H22l-3-5h-4v8l1 5z" fill="${color}"/>
      <circle cx="18" cy="32" r="3" fill="#1a1d2e"/><circle cx="30" cy="32" r="3" fill="#1a1d2e"/><circle cx="24" cy="18" r="2.5" fill="#1a1d2e"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 48 48" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="22" fill="white" stroke="${color}" stroke-width="3"/>
    <path d="M18 30c4-8 8-10 14-10l2 4c-5 1-8 3-10 8h-6z" fill="${color}"/>
    <circle cx="20" cy="32" r="3.2" fill="#1a1d2e"/><circle cx="30" cy="32" r="3.2" fill="#1a1d2e"/>
  </svg>`;
}

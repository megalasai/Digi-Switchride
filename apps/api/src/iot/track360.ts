export type Track360Device = {
  deviceId: string;
  imei: string;
  vendorDeviceId?: string;
  name: string;
  vehicleNumber?: string;
  lat: number | null;
  lng: number | null;
  batteryPercent?: number;
  odometerKm?: number;
  speedKmh?: number;
  ignition?: string;
  vendorStatus: string;
  vehicleStatus?: string;
  lastSeenAt?: Date;
  phone?: string;
  type?: string;
  course?: string;
};

type Track360Row = Record<string, unknown>;

export function parseTrack360Payload(payload: unknown): Track360Device[] {
  return collectRows(payload)
    .map(mapRow)
    .filter((row) => Boolean(row.deviceId));
}

function collectRows(payload: unknown, depth = 0): Track360Row[] {
  if (payload == null || depth > 5) return [];
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectRows(item, depth + 1));
  }
  if (typeof payload !== 'object') return [];
  const rec = payload as Track360Row;
  const looksLikeDevice =
    rec.latitude != null ||
    rec.lat != null ||
    rec.longitude != null ||
    rec.lng != null ||
    rec.deviceImei != null ||
    rec.imei != null ||
    rec.deviceId != null;
  if (looksLikeDevice) return [rec];
  const nested = ['data', 'result', 'devices', 'list', 'rows', 'items', 'vehicleList', 'VehicleList'];
  const out: Track360Row[] = [];
  for (const key of nested) {
    if (rec[key] != null) out.push(...collectRows(rec[key], depth + 1));
  }
  return out;
}

function mapRow(row: Track360Row): Track360Device {
  const imei = str(row.deviceImei ?? row.imei);
  const numericId = str(row.deviceId);
  const lat = num(row.latitude ?? row.lat);
  const lng = num(row.longitude ?? row.lng ?? row.lon);
  const batteryRaw = num(row.soc ?? row.batteryPercent ?? row.batteryLevel);
  const distance = num(row.totalDistance ?? row.odometerKm ?? row.odometer);
  const speed = num(row.speed);
  const vehicleNumber = str(
    row.vehicle_no ??
      row.vehicleNo ??
      row.vehicleNumber ??
      row.vehicleno ??
      row.vehicle_number ??
      row.registrationNumber ??
      row.regNo ??
      row.reg_no ??
      row.vehicleRegNo ??
      row.VehicleNo ??
      row.vehicle,
  );
  const name = str(row.name) || vehicleNumber;
  return {
    deviceId: imei || numericId,
    imei,
    vendorDeviceId: numericId || undefined,
    name,
    vehicleNumber: vehicleNumber || undefined,
    lat: lat != null && Math.abs(lat) <= 90 && !(lat === 0 && lng === 0) ? lat : null,
    lng: lng != null && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0) ? lng : null,
    batteryPercent: batteryRaw != null && batteryRaw >= 0 && batteryRaw <= 100 ? batteryRaw : undefined,
    odometerKm: toKm(distance),
    speedKmh: speed,
    ignition: str(row.ignition),
    vendorStatus: str(row.status) || 'Unknown',
    vehicleStatus: str(row.vehicle_status),
    lastSeenAt: dateish(row.lastUpdate ?? row.deviceTime ?? row.deviceFixTime),
    phone: str(row.phone),
    type: str(row.type),
    course: str(row.course),
  };
}

function str(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return typeof value === 'string' ? value.trim() : '';
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toKm(distance?: number): number | undefined {
  if (distance == null) return undefined;
  if (distance > 10_000) return Math.round((distance / 1000) * 100) / 100;
  return Math.round(distance * 100) / 100;
}

function dateish(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function track360AuthHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export function track360PullUrl(baseUrl: string, username: string, password: string) {
  const url = new URL(baseUrl);
  url.searchParams.set('username', username);
  url.searchParams.set('password', password);
  return url.toString();
}

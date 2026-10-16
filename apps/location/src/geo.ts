const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.32;

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a))) * 1000;
}

export function radiusToDelta(latitude: number, radiusKm: number): { dLat: number; dLon: number } {
  const dLat = radiusKm / KM_PER_DEGREE_LAT;
  const cosine = Math.cos((latitude * Math.PI) / 180);
  const dLon = radiusKm / (KM_PER_DEGREE_LAT * Math.max(0.2, Math.abs(cosine)));
  return { dLat, dLon };
}

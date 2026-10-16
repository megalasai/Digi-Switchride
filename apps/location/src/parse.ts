const SKIPPED_FEATURES = new Set(['PPLH', 'PPLQ', 'PPLW', 'PPLCH']);
const ROAD_NAME =
  /\b(road|rd|flyover|circle|cross|street|st|lane|ln|marg|bridge|highway|hwy|expressway|overbridge|underpass)\b/i;

export type PlaceInsert = {
  id: number;
  name: string;
  asciiName: string;
  lat: number;
  lon: number;
  featureCode: string;
  admin1Code: string | null;
  admin2Code: string | null;
  population: number;
  elevation: number | null;
  dem: number | null;
  timezone: string | null;
};

export type PostalInsert = {
  postalCode: string;
  placeName: string;
  admin1Name: string | null;
  admin2Name: string | null;
  lat: number;
  lon: number;
};

export type AdminInsert = {
  code: string;
  admin1Code: string | null;
  name: string;
  asciiName: string;
};

function cleanLine(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

function elevation(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < -100) return null;
  return parsed;
}

export function isPlausibleIndiaCoordinate(lat: number, lon: number): boolean {
  return lat >= 6 && lat <= 37.6 && lon >= 67 && lon <= 98.5;
}

export function parsePlaceLine(line: string): PlaceInsert | null {
  const text = cleanLine(line);
  if (!text || text.startsWith('#')) return null;
  const columns = text.split('\t');
  if (columns.length < 19 || columns[6] !== 'P' || columns[8] !== 'IN') return null;
  if (SKIPPED_FEATURES.has(columns[7])) return null;

  const id = Number.parseInt(columns[0], 10);
  const lat = Number(columns[4]);
  const lon = Number(columns[5]);
  if (!Number.isInteger(id) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isPlausibleIndiaCoordinate(lat, lon)) return null;

  const name = columns[1].trim();
  if (!name) return null;
  const population = Number.parseInt(columns[14], 10);
  const populationValue = Number.isFinite(population) ? population : 0;
  if (populationValue === 0 && ROAD_NAME.test(name)) return null;

  return {
    id,
    name,
    asciiName: columns[2].trim() || name,
    lat,
    lon,
    featureCode: columns[7],
    admin1Code: columns[10] || null,
    admin2Code: columns[11] || null,
    population: populationValue,
    elevation: elevation(columns[15]),
    dem: elevation(columns[16]),
    timezone: columns[17] || null,
  };
}

export function parsePostalLine(line: string): PostalInsert | null {
  const text = cleanLine(line);
  if (!text || text.startsWith('#')) return null;
  const columns = text.split('\t');
  if (columns.length < 11 || columns[0] !== 'IN') return null;

  const lat = Number(columns[9]);
  const lon = Number(columns[10]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  if (!isPlausibleIndiaCoordinate(lat, lon)) return null;

  const postalCode = columns[1].trim();
  const placeName = columns[2].trim();
  if (!postalCode || !placeName) return null;

  return {
    postalCode,
    placeName,
    admin1Name: columns[3]?.trim() || null,
    admin2Name: columns[5]?.trim() || null,
    lat,
    lon,
  };
}

export function parseAdmin1Line(line: string): AdminInsert | null {
  const text = cleanLine(line);
  if (!text.startsWith('IN.')) return null;
  const columns = text.split('\t');
  if (columns.length < 3) return null;
  const code = columns[0].slice(3);
  if (!code || code.includes('.')) return null;
  return { code, admin1Code: null, name: columns[1], asciiName: columns[2] || columns[1] };
}

export function parseAdmin2Line(line: string): AdminInsert | null {
  const text = cleanLine(line);
  if (!text.startsWith('IN.')) return null;
  const columns = text.split('\t');
  if (columns.length < 3) return null;
  const segments = columns[0].split('.');
  if (segments.length < 3) return null;
  return {
    code: segments.slice(1).join('.'),
    admin1Code: segments[1],
    name: columns[1],
    asciiName: columns[2] || columns[1],
  };
}

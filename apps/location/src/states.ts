const STATE_CODES: Record<string, string> = {
  'andaman and nicobar': 'AN',
  'andaman and nicobar islands': 'AN',
  'andhra pradesh': 'AP',
  'arunachal pradesh': 'AR',
  assam: 'AS',
  bihar: 'BR',
  chandigarh: 'CH',
  chhattisgarh: 'CT',
  'dadra and nagar haveli': 'DH',
  'daman and diu': 'DH',
  'dadra and nagar haveli and daman and diu': 'DH',
  delhi: 'DL',
  'national capital territory of delhi': 'DL',
  'nct of delhi': 'DL',
  goa: 'GA',
  gujarat: 'GJ',
  haryana: 'HR',
  'himachal pradesh': 'HP',
  'jammu and kashmir': 'JK',
  jharkhand: 'JH',
  karnataka: 'KA',
  kerala: 'KL',
  ladakh: 'LA',
  lakshadweep: 'LD',
  'madhya pradesh': 'MP',
  maharashtra: 'MH',
  manipur: 'MN',
  meghalaya: 'ML',
  mizoram: 'MZ',
  nagaland: 'NL',
  odisha: 'OR',
  orissa: 'OR',
  puducherry: 'PY',
  pondicherry: 'PY',
  punjab: 'PB',
  rajasthan: 'RJ',
  sikkim: 'SK',
  'tamil nadu': 'TN',
  telangana: 'TG',
  tripura: 'TR',
  'uttar pradesh': 'UP',
  uttarakhand: 'UT',
  uttaranchal: 'UT',
  'west bengal': 'WB',
};

export function stateCodeFor(name: string | null | undefined): string | null {
  if (!name) return null;
  const normalized = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return STATE_CODES[normalized] ?? null;
}

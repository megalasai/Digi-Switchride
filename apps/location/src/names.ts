const ALIASES: Array<[RegExp, string]> = [
  [/bengaluru/g, 'bangalore'],
  [/bombay/g, 'mumbai'],
  [/calcutta/g, 'kolkata'],
  [/madras/g, 'chennai'],
  [/trivandrum/g, 'thiruvananthapuram'],
  [/baroda/g, 'vadodara'],
  [/pondicherry/g, 'puducherry'],
];

export function adminKey(value: string | null | undefined): string | null {
  if (!value) return null;
  let text = value.toLowerCase().replace(/&/g, ' and ');
  text = text.replace(/\b(nct of|national capital territory of)\b/g, ' ');
  for (const [pattern, replacement] of ALIASES) text = text.replace(pattern, replacement);
  text = text.replace(/\b(urban|rural|district|division|city)\b/g, ' ');
  text = text.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

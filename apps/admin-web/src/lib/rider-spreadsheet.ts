export type RiderImportRow = { fullName: string; phone: string; email?: string };

const HEADERS = {
  fullName: ["fullname", "full_name", "name", "ridername", "rider_name"],
  phone: ["phone", "mobile", "mobilenumber", "mobile_number", "phonenumber", "phone_number"],
  email: ["email", "emailid", "email_id"],
};

function normHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((c) => c)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some((c) => c)) rows.push(row);
  }
  return rows;
}

function mapRows(table: string[][]): RiderImportRow[] {
  if (!table.length) return [];
  const header = table[0].map(normHeader);
  const idx = (aliases: string[]) => header.findIndex((h) => aliases.includes(h));
  const nameI = idx(HEADERS.fullName);
  const phoneI = idx(HEADERS.phone);
  const emailI = idx(HEADERS.email);
  if (nameI < 0 || phoneI < 0) {
    throw new Error("The file needs columns fullName and phone (email optional). Download the template and keep the header row.");
  }
  const out: RiderImportRow[] = [];
  for (const raw of table.slice(1)) {
    const fullName = (raw[nameI] ?? "").trim();
    const phone = (raw[phoneI] ?? "").trim();
    const email = emailI >= 0 ? (raw[emailI] ?? "").trim() : "";
    if (!fullName && !phone && !email) continue;
    out.push({ fullName, phone, email: email || undefined });
  }
  return out;
}

async function inflate(data: Uint8Array) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot read Excel files. Save as CSV and upload.");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function u16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}
function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

async function unzip(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const files = new Map<string, string>();
  let offset = 0;
  while (offset + 30 <= bytes.length && u32(view, offset) === 0x04034b50) {
    const method = u16(view, offset + 8);
    const compSize = u32(view, offset + 18);
    const nameLen = u16(view, offset + 26);
    const extraLen = u16(view, offset + 28);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLen));
    const start = offset + 30 + nameLen + extraLen;
    const packed = bytes.slice(start, start + compSize);
    offset = start + compSize;
    if (name.endsWith("/")) continue;
    let raw = packed;
    if (method === 8) raw = await inflate(packed);
    else if (method !== 0) continue;
    files.set(name, new TextDecoder("utf-8").decode(raw));
  }
  return files;
}

function xmlCells(xml: string) {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];
      const t = /t="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)?.[1] ?? "";
      cells.push(JSON.stringify({ t, v }));
    }
    rows.push(cells);
  }
  return rows;
}

async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf);
  const shared = files.get("xl/sharedStrings.xml") ?? "";
  const strings: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let si: RegExpExecArray | null;
  while ((si = siRe.exec(shared))) {
    const texts = [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gi)].map((m) => m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
    strings.push(texts.join(""));
  }
  const sheet = files.get("xl/worksheets/sheet1.xml") ?? [...files.entries()].find(([k]) => k.startsWith("xl/worksheets/sheet"))?.[1];
  if (!sheet) throw new Error("Could not read the Excel sheet. Save as CSV UTF-8 and upload.");
  return xmlCells(sheet).map((row) =>
    row.map((raw) => {
      const parsed = JSON.parse(raw) as { t?: string; v: string };
      if (parsed.t === "s") return strings[Number(parsed.v)] ?? "";
      return parsed.v;
    }),
  );
}

export async function parseRiderFile(file: File): Promise<RiderImportRow[]> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const table = isZip ? await parseXlsx(buf) : parseCsv(new TextDecoder("utf-8").decode(buf));
  return mapRows(table);
}

export function riderTemplateCsv() {
  return "\uFEFFfullName,phone,email\nPriya Sharma,9876543210,priya@example.com\n";
}

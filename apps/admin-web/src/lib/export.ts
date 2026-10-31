function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadCsv(fileName: string, headers: string[], rows: unknown[][]) {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPdf(title: string, headers: string[], rows: unknown[][]) {
  const table = `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell == null ? "" : String(cell))}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
  const html = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 12px}
    p{font-size:12px;color:#555}
    table{border-collapse:collapse;width:100%;font-size:11px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
    th{background:#f3f4f6}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>${rows.length} row(s) · ${new Date().toLocaleString()}</p>${table}
  <script>window.onload=()=>window.print()</script></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

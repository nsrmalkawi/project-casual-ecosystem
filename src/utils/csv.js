// src/utils/csv.js
// Generic CSV helpers for exporting and importing tabular data.

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function exportToCsv(filename, fields, rows) {
  // fields: [{ key, label, ... }]
  const header = fields.map((f) => escapeCsv(f.label)).join(",");
  const lines = rows.map((row) =>
    fields
      .map((f) => {
        const v = row[f.key];
        return escapeCsv(v === undefined || v === null ? "" : v);
      })
      .join(",")
  );

  const csv = [header, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parse a single CSV line with basic quote handling
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// text: CSV string, fields: [{ key, label, ... }]
export function parseCsvTextToRows(text, fields) {
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l !== "");

  if (lines.length < 2) return [];

  const headerParts = parseCsvLine(lines[0]).map((h) => h.trim());

  // Map field -> column index by label
  const colIndexes = fields.map((f) => headerParts.indexOf(f.label));

  const dataRows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = parseCsvLine(line);

    const row = {};
    fields.forEach((f, idx) => {
      const colIndex = colIndexes[idx];
      if (colIndex === -1) {
        row[f.key] = "";
      } else {
        const raw = parts[colIndex] !== undefined ? parts[colIndex] : "";
        row[f.key] = String(raw).trim();
      }
    });

    // Skip completely empty logical rows
    const hasAny = fields.some((f) => row[f.key] && row[f.key] !== "");
    if (hasAny) {
      dataRows.push(row);
    }
  }

  return dataRows;
}

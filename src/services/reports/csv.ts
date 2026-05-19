function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = value instanceof Date ? value.toISOString() : String(value);
  const escaped = text.replace(/"/g, '""');

  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

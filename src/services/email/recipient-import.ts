import * as XLSX from "xlsx";

export type RecipientRow = {
  email: string;
  nome?: string;
  cpf?: string;
  setor?: string;
  cargo?: string;
  orgao?: string;
  cidade?: string;
  estado?: string;
  tags?: string;
  [key: string]: string | undefined;
};

export type RecipientImportError = {
  rowNumber: number;
  email?: string;
  reason: string;
  rawData: Record<string, unknown>;
};

export type ParsedRecipientImport = {
  totalRows: number;
  validRows: RecipientRow[];
  errors: RecipientImportError[];
  duplicatesRemoved: number;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getEmailDomain(email: string): string {
  return email.trim().toLowerCase().split("@").at(1) ?? "";
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeRow(row: Record<string, unknown>): RecipientRow {
  const normalized: RecipientRow = { email: "" };

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key);
    normalized[normalizedKey] = value === undefined || value === null ? undefined : String(value).trim();
  }

  normalized.email = (normalized.email ?? "").trim().toLowerCase();

  return normalized;
}

function parseDelimitedText(text: string): Record<string, unknown>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((header) => normalizeKey(header));
  const hasEmailHeader = headers.includes("email");

  if (!hasEmailHeader) {
    return lines.map((line) => {
      const [email, nome] = line.split(/[;,]/).map((part) => part.trim());
      return { email, nome };
    });
  }

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function buildParsedImport(rows: Record<string, unknown>[]): ParsedRecipientImport {
  const validRows: RecipientRow[] = [];
  const errors: RecipientImportError[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  rows.forEach((rawRow, index) => {
    const row = normalizeRow(rawRow);
    const email = row.email;

    if (!email || !emailRegex.test(email)) {
      errors.push({
        rowNumber: index + 1,
        email,
        reason: "E-mail inválido.",
        rawData: rawRow
      });
      return;
    }

    if (seen.has(email)) {
      duplicatesRemoved += 1;
      return;
    }

    seen.add(email);
    validRows.push(row);
  });

  return {
    totalRows: rows.length,
    validRows,
    errors,
    duplicatesRemoved
  };
}

export function parseRecipientText(text: string): ParsedRecipientImport {
  return buildParsedImport(parseDelimitedText(text));
}

export async function parseRecipientFile(file: File): Promise<ParsedRecipientImport> {
  const filename = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet] ?? {});
    return buildParsedImport(rows);
  }

  return parseRecipientText(buffer.toString("utf8"));
}

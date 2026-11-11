import { Workbook, type CellValue, type Worksheet } from "exceljs";

/**
 * Lectura de los Excel que sube el cliente (carga masiva de empleados).
 *
 * Se usa `exceljs` y no `xlsx` porque el archivo lo elige quien sube el
 * documento: `xlsx@0.18.5` (última versión publicada en npm) arrastra
 * CVE-2023-30533 y CVE-2024-22363, cuya corrección no está en el registro.
 * Solo se acepta el formato OOXML (.xlsx).
 */

/** Valor "real" de una celda: texto, número, fecha o booleano. */
const plainValue = (value: CellValue): string | number | boolean | Date => {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return String(value.text);
  if ("result" in value) return plainValue(value.result as CellValue);
  return "";
};

const loadFirstSheet = async (buffer: Buffer): Promise<Worksheet | undefined> => {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.getWorksheet(1);
};

const headerOf = (sheet: Worksheet): string[] => {
  const row = sheet.getRow(1);
  const headers: string[] = [];
  for (let column = 1; column <= sheet.columnCount; column++) {
    headers.push(String(plainValue(row.getCell(column).value) ?? "").trim());
  }
  return headers;
};

/** Lee la primera hoja de un buffer .xlsx y regresa un arreglo de filas
 * como objetos { <encabezado>: <valor> }, en el orden en que aparecen. */
export const parseFirstSheet = async (buffer: Buffer): Promise<Record<string, unknown>[]> => {
  const sheet = await loadFirstSheet(buffer);
  if (!sheet) return [];
  const headers = headerOf(sheet);
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    let hasValue = false;
    for (let column = 1; column <= headers.length; column++) {
      const header = headers[column - 1];
      if (!header) continue;
      const value = plainValue(row.getCell(column).value);
      if (value !== "") hasValue = true;
      values[header] = value;
    }
    if (hasValue) rows.push(values);
  });
  return rows;
};

export const firstSheetHeaders = async (buffer: Buffer): Promise<string[]> => {
  const sheet = await loadFirstSheet(buffer);
  return sheet ? headerOf(sheet) : [];
};

const stripAccents = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Normaliza un encabezado de columna para comparar sin importar acentos,
 * mayúsculas/minúsculas o espacios extra ("Descripción " -> "DESCRIPCION"). */
export const normalizeHeader = (s: unknown): string =>
  stripAccents(String(s ?? "")).trim().toUpperCase();

export const hasColumn = (row: Record<string, unknown>, candidate: string): boolean => {
  const expected = normalizeHeader(candidate);
  return Object.keys(row).some((key) => normalizeHeader(key) === expected);
};

/** Busca el valor de una fila probando varios nombres de columna posibles
 * (normalizados), para tolerar variaciones de encabezado entre archivos. */
export const pickColumn = (
  row: Record<string, unknown>,
  candidates: string[]
): string => {
  const normalizedRow: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    normalizedRow[normalizeHeader(k)] = v;
  }
  for (const candidate of candidates) {
    const key = normalizeHeader(candidate);
    const value = normalizedRow[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

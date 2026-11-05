import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  canonicalJson,
  compareManifests,
  fileRelPath,
  hashRows,
  topologicalOrder,
  type BackupManifest,
  type FileManifest,
  type TableManifest,
} from "@core/backup/tenant-slice";

/**
 * Núcleo del respaldo por cliente (F4-04): descubre las tablas con `tenantId`,
 * exporta el slice + las filas de catálogos globales que referencia (p. ej.
 * `plans`), restaura en orden de FKs y verifica conteos/hashes.
 *
 * Lo usan `scripts/tenant-backup.ts` (CLI) y `scripts/tenant-backup.rehearse.ts`
 * (ensayo). La parte pura y testeable está en `src/core/backup/tenant-slice.ts`.
 */

export interface TableInfo {
  table: string;
  columns: string[];
  types: Record<string, string>;
  pk: string[];
}

export interface ForeignKey {
  child: string;
  parent: string;
  childColumns: string[];
  parentColumns: string[];
}

export interface SchemaInfo {
  tables: Map<string, TableInfo>;
  foreignKeys: ForeignKey[];
}

export interface TableRows {
  table: string;
  columns: string[];
  types: Record<string, string>;
  pk: string[];
  rows: Record<string, unknown>[];
}

export interface Slice {
  manifest: BackupManifest;
  tables: TableRows[];
  prerequisites: TableRows[];
  /** Contenido de los objetos S3 exportados (vacío sin `--s3`). */
  files: Array<{ manifest: FileManifest; body: Buffer }>;
}

const q = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

export const createClient = (url: string): PrismaClient =>
  new PrismaClient({ datasources: { db: { url } }, log: ["error"] });

/** Catálogo de tablas/columnas/FKs del esquema público. */
export const discoverSchema = async (db: PrismaClient): Promise<SchemaInfo> => {
  // `format_type` da el tipo usable en un CAST ($1::"PunchMethod", $1::timestamptz, …).
  const columns = await db.$queryRawUnsafe<
    Array<{ table_name: string; column_name: string; data_type: string }>
  >(
    `SELECT c.relname AS table_name, a.attname AS column_name,
            format_type(a.atttypid, a.atttypmod) AS data_type
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY c.relname, a.attnum`
  );
  const pkRows = await db.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
    `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.ordinal_position`
  );
  const fkRows = await db.$queryRawUnsafe<
    Array<{ child: string; parent: string; child_columns: string; parent_columns: string }>
  >(
    `SELECT child.relname AS child,
            parent.relname AS parent,
            array_to_string(array_agg(att.attname ORDER BY ord.ordinality), ',') AS child_columns,
            array_to_string(array_agg(patt.attname ORDER BY pord.ordinality), ',') AS parent_columns
       FROM pg_constraint con
       JOIN pg_class child ON child.oid = con.conrelid
       JOIN pg_class parent ON parent.oid = con.confrelid
       JOIN unnest(con.conkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
       JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ord.attnum
       JOIN unnest(con.confkey) WITH ORDINALITY AS pord(attnum, ordinality)
         ON pord.ordinality = ord.ordinality
       JOIN pg_attribute patt ON patt.attrelid = con.confrelid AND patt.attnum = pord.attnum
      WHERE con.contype = 'f'
      GROUP BY con.conname, child.relname, parent.relname`
  );

  const tables = new Map<string, TableInfo>();
  for (const entry of columns) {
    if (!tables.has(entry.table_name)) {
      tables.set(entry.table_name, { table: entry.table_name, columns: [], types: {}, pk: [] });
    }
    const info = tables.get(entry.table_name)!;
    info.columns.push(entry.column_name);
    info.types[entry.column_name] = entry.data_type;
  }
  for (const entry of pkRows) tables.get(entry.table_name)?.pk.push(entry.column_name);

  return {
    tables,
    foreignKeys: fkRows.map((row) => ({
      child: row.child,
      parent: row.parent,
      childColumns: String(row.child_columns).split(",").filter(Boolean),
      parentColumns: String(row.parent_columns).split(",").filter(Boolean),
    })),
  };
};

/** Tablas que llevan `tenantId` (más `tenants`, que es la raíz del slice). */
export const tenantTablesOf = (schema: SchemaInfo): string[] => {
  const withTenant = [...schema.tables.values()]
    .filter((info) => info.columns.includes("tenantId"))
    .map((info) => info.table)
    .sort();
  return ["tenants", ...withTenant.filter((table) => table !== "tenants")];
};

export const resolveTenant = async (
  db: PrismaClient,
  reference: string
): Promise<{ id: string; slug: string; name: string }> => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference);
  const rows = await db.$queryRawUnsafe<Array<{ id: string; slug: string; name: string }>>(
    isUuid
      ? `SELECT id, slug, name FROM "tenants" WHERE id = $1`
      : `SELECT id, slug, name FROM "tenants" WHERE slug = $1`,
    reference
  );
  if (rows.length === 0) throw new Error(`No existe el cliente "${reference}"`);
  return rows[0];
};

const selectRows = async (
  db: PrismaClient,
  info: TableInfo,
  where: string,
  values: unknown[]
): Promise<Record<string, unknown>[]> =>
  db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM ${q(info.table)} WHERE ${where}`,
    ...values
  );

const toTableRows = async (
  db: PrismaClient,
  schema: SchemaInfo,
  table: string,
  where: string,
  values: unknown[]
): Promise<TableRows> => {
  const info = schema.tables.get(table);
  if (!info) throw new Error(`La tabla "${table}" no existe en el esquema`);
  const rows = await selectRows(db, info, where, values);
  return { table, columns: info.columns, types: info.types, pk: info.pk, rows };
};

/** Columnas con llaves de S3 que puede tocar un cliente. */
const FILE_COLUMNS: Record<string, string> = {
  users: "photoKey",
  employee_documents: "storageKey",
};

const downloadFiles = async (
  sliceTables: TableRows[]
): Promise<Array<{ manifest: FileManifest; body: Buffer }>> => {
  const files: Array<{ manifest: FileManifest; body: Buffer }> = [];
  const storage = await import("@core/services/storage");
  for (const table of sliceTables) {
    const column = FILE_COLUMNS[table.table];
    if (!column || !table.columns.includes(column)) continue;
    for (const row of table.rows) {
      const key = row[column];
      if (typeof key !== "string" || key.trim() === "") continue;
      const body = await storage.downloadObject(key);
      files.push({
        manifest: { table: table.table, column, key, path: fileRelPath(key), bytes: body.length },
        body,
      });
    }
  }
  return files;
};

/**
 * Exporta el slice del cliente: fila de `tenants`, todas las tablas con
 * `tenantId` y las filas de catálogos globales que esas filas referencian.
 */
export const exportSlice = async (
  db: PrismaClient,
  tenantReference: string,
  options: { s3?: boolean } = {}
): Promise<Slice> => {
  const tenant = await resolveTenant(db, tenantReference);
  const schema = await discoverSchema(db);
  const tenantTables = tenantTablesOf(schema);
  const exported = new Set(tenantTables);

  const tables: TableRows[] = [];
  for (const table of tenantTables) {
    const where = table === "tenants" ? `"id" = $1` : `"tenantId" = $1`;
    const rows = await toTableRows(db, schema, table, where, [tenant.id]);
    if (table === "tenants" && rows.rows.length === 0) {
      throw new Error(`No existe el cliente "${tenantReference}"`);
    }
    tables.push(rows);
  }

  // Catálogos globales referenciados (p. ej. tenants.planId → plans).
  const prerequisites = new Map<string, TableRows>();
  const queue = [...tables];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const fk of schema.foreignKeys) {
      if (fk.child !== current.table) continue;
      if (exported.has(fk.parent)) continue;
      if (fk.childColumns.length !== 1 || fk.parentColumns.length !== 1) continue;
      if (visited.has(`${current.table}:${fk.parent}:${fk.childColumns[0]}`)) continue;
      visited.add(`${current.table}:${fk.parent}:${fk.childColumns[0]}`);
      const values = [
        ...new Set(
          current.rows
            .map((row) => row[fk.childColumns[0]])
            .filter((value): value is string | number => value !== null && value !== undefined)
        ),
      ];
      if (values.length === 0) continue;
      const parentInfo = schema.tables.get(fk.parent);
      if (!parentInfo) continue;
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
      const rows = await toTableRows(
        db,
        schema,
        fk.parent,
        `${q(fk.parentColumns[0])} IN (${placeholders})`,
        values
      );
      if (rows.rows.length === 0) continue;
      const existing = prerequisites.get(fk.parent);
      prerequisites.set(
        fk.parent,
        existing
          ? {
              ...existing,
              rows: [
                ...existing.rows,
                ...rows.rows.filter(
                  (row) => !existing.rows.some((prev) => canonicalJson(prev) === canonicalJson(row))
                ),
              ],
            }
          : rows
      );
      queue.push(rows);
    }
  }

  const toManifest = (list: TableRows[]): TableManifest[] =>
    list.map((entry) => ({
      table: entry.table,
      columns: entry.columns,
      count: entry.rows.length,
      sha256: hashRows(entry.rows),
    }));

  const files = options.s3 ? await downloadFiles(tables) : [];
  const databaseUrl = process.env.DATABASE_URL ?? "";

  let database = "(desconocida)";
  try {
    database = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  } catch {
    // Sin URL legible no hay nombre de BD; el resto del respaldo sigue.
  }

  return {
    manifest: {
      version: 1,
      exportedAt: new Date().toISOString(),
      tenant,
      database,
      tables: toManifest(tables),
      prerequisites: toManifest([...prerequisites.values()]),
      files: files.map((file) => file.manifest),
    },
    tables,
    prerequisites: [...prerequisites.values()],
    files,
  };
};

/** Escribe el respaldo en disco: manifest.json + data/*.json + files/*. */
export const writeSlice = (dir: string, slice: Slice): void => {
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.mkdirSync(path.join(dir, "prerequisites"), { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(slice.manifest, null, 2), "utf8");
  for (const table of [...slice.tables, ...slice.prerequisites]) {
    const folder = slice.tables.includes(table) ? "data" : "prerequisites";
    fs.writeFileSync(
      path.join(dir, folder, `${table.table}.json`),
      JSON.stringify(table.rows, null, 2),
      "utf8"
    );
  }
  for (const file of slice.files) {
    const target = path.join(dir, file.manifest.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.body);
  }
};

export const loadSlice = (dir: string): Slice => {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as BackupManifest;
  const readTable = (folder: string, table: string): Record<string, unknown>[] => {
    const file = path.join(dir, folder, `${table}.json`);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>[];
  };
  const fromManifest = (entries: TableManifest[], folder: string): TableRows[] =>
    entries.map((entry) => ({
      table: entry.table,
      columns: entry.columns,
      types: {},
      pk: [],
      rows: readTable(folder, entry.table),
    }));
  return {
    manifest,
    tables: fromManifest(manifest.tables, "data"),
    prerequisites: fromManifest(manifest.prerequisites, "prerequisites"),
    files: [],
  };
};

const formatArray = (value: unknown[]): string => `{${value.map(formatArrayItem).join(",")}}`;
const formatArrayItem = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
};

/** Valor para `$executeRawUnsafe`: JSON/array como texto, fechas ISO, resto igual. */
const rawValue = (value: unknown, dataType: string | undefined): unknown => {
  if (value === null || value === undefined) return null;
  if ((dataType ?? "").startsWith("json")) return JSON.stringify(value);
  if ((dataType ?? "").endsWith("[]")) {
    return Array.isArray(value) ? formatArray(value) : JSON.stringify(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object" && !Array.isArray(value)) {
    // Prisma.Decimal y similares: su representación textual es válida para numeric.
    return String(value);
  }
  return value;
};

const insertRows = async (
  db: PrismaClient,
  schema: SchemaInfo,
  entry: TableRows
): Promise<number> => {
  if (entry.rows.length === 0) return 0;
  const info = schema.tables.get(entry.table);
  const columns = entry.columns.filter((column) => info?.columns.includes(column));
  if (columns.length === 0) throw new Error(`La tabla "${entry.table}" no existe en la BD destino`);
  // CAST explícito: el parámetro llega como texto y Postgres no castea text→timestamp
  // ni text→enum de forma implícita en un INSERT preparado.
  const placeholders = columns
    .map((column, index) => {
      const type = info?.types[column];
      return type ? `$${index + 1}::${type}` : `$${index + 1}`;
    })
    .join(", ");
  const sql = `INSERT INTO ${q(entry.table)} (${columns.map(q).join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
  let inserted = 0;
  for (const row of entry.rows) {
    const values = columns.map((column) =>
      rawValue(row[column], entry.types[column] ?? info?.types[column])
    );
    const result = await db.$executeRawUnsafe(sql, ...values);
    inserted += Number(result) || 0;
  }
  return inserted;
};

const countTenantRows = async (
  db: PrismaClient,
  table: string,
  tenantId: string
): Promise<number> => {
  const where = table === "tenants" ? `"id" = $1` : `"tenantId" = $1`;
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM ${q(table)} WHERE ${where}`,
    tenantId
  );
  return Number(rows[0]?.count ?? 0);
};

/** ¿La BD destino ya tiene datos de este cliente? (una BD limpia no debería) */
export const existingRowsOf = async (
  db: PrismaClient,
  tenantId: string,
  tables: readonly string[]
): Promise<Array<{ table: string; count: number }>> => {
  const schema = await discoverSchema(db);
  const found: Array<{ table: string; count: number }> = [];
  for (const table of tables) {
    if (!schema.tables.has(table)) continue;
    const count = await countTenantRows(db, table, tenantId);
    if (count > 0) found.push({ table, count });
  }
  return found;
};

/**
 * Borra el slice completo del cliente (para simular pérdida o `--replace`).
 *
 * `bypassTriggers` desactiva los triggers de inmutabilidad (checadas
 * append-only de NOM) con `session_replication_role = replica`: solo funciona
 * con un rol superusuario o dueño de las tablas. Sin él, si el cliente tiene
 * checadas el DELETE se rechaza (a propósito) y hay que restaurar en una BD
 * limpia en vez de borrar sobre la existente.
 */
export const deleteSlice = async (
  db: PrismaClient,
  tenantId: string,
  options: { bypassTriggers?: boolean } = {}
): Promise<void> => {
  const schema = await discoverSchema(db);
  const tables = tenantTablesOf(schema);
  const order = topologicalOrder(
    tables,
    schema.foreignKeys.map((fk) => ({ child: fk.child, parent: fk.parent }))
  ).reverse();

  const statements: Array<ReturnType<PrismaClient["$executeRawUnsafe"]>> = [];
  if (options.bypassTriggers) {
    statements.push(db.$executeRawUnsafe("SET LOCAL session_replication_role = replica"));
  }
  for (const table of order) {
    if (table === "tenants") continue;
    statements.push(db.$executeRawUnsafe(`DELETE FROM ${q(table)} WHERE "tenantId" = $1`, tenantId));
  }
  statements.push(db.$executeRawUnsafe(`DELETE FROM "tenants" WHERE id = $1`, tenantId));

  if (options.bypassTriggers) {
    await db.$transaction(statements);
    return;
  }
  for (const statement of statements) await statement;
};

/**
 * Restaura el slice en la BD destino. Por defecto exige que no haya datos del
 * cliente; con `replace` los borra antes. Restaura primero los catálogos
 * globales y después las tablas en orden de FKs.
 */
export const restoreSlice = async (
  db: PrismaClient,
  slice: Slice,
  options: { replace?: boolean; s3?: boolean; bypassTriggers?: boolean } = {}
): Promise<{ inserted: Array<{ table: string; rows: number }> }> => {
  const schema = await discoverSchema(db);
  const tableNames = slice.manifest.tables.map((entry) => entry.table);
  const existing = await existingRowsOf(db, slice.manifest.tenant.id, tableNames);
  if (existing.length > 0 && !options.replace) {
    const detail = existing.map((entry) => `${entry.table}=${entry.count}`).join(", ");
    throw new Error(
      `La BD destino ya tiene datos de este cliente (${detail}). Usa --replace solo si estás seguro.`
    );
  }
  if (existing.length > 0 && options.replace) {
    await deleteSlice(db, slice.manifest.tenant.id, { bypassTriggers: options.bypassTriggers });
  }

  const inserted: Array<{ table: string; rows: number }> = [];
  for (const entry of slice.prerequisites) {
    inserted.push({ table: entry.table, rows: await insertRows(db, schema, entry) });
  }

  const order = topologicalOrder(
    tableNames,
    schema.foreignKeys.map((fk) => ({ child: fk.child, parent: fk.parent }))
  );
  const byTable = new Map(slice.tables.map((entry) => [entry.table, entry]));
  for (const table of order) {
    const entry = byTable.get(table);
    if (!entry) continue;
    inserted.push({ table, rows: await insertRows(db, schema, entry) });
  }

  return { inserted };
};

/** Reexporta el slice en la BD destino y lo compara con el manifiesto original. */
export const verifySlice = async (
  db: PrismaClient,
  manifest: BackupManifest
): Promise<{ ok: boolean; problems: string[]; tables: TableManifest[] }> => {
  const tenant = await resolveTenant(db, manifest.tenant.slug);
  const slice = await exportSlice(db, tenant.id);
  const problems = compareManifests(manifest.tables, slice.manifest.tables);
  // Los catálogos globales pueden tener filas de otros clientes: solo se
  // comparan los que el respaldo incluyó, por id.
  for (const expected of manifest.prerequisites) {
    const actual = slice.manifest.prerequisites.find((entry) => entry.table === expected.table);
    if (!actual) {
      problems.push(`${expected.table}: falta el catálogo global referenciado`);
      continue;
    }
    if (actual.count < 0) problems.push(`${expected.table}: conteo inválido`);
  }
  return { ok: problems.length === 0, problems, tables: slice.manifest.tables };
};

/** Restaura objetos S3 del respaldo (requiere storage configurado). */
export const restoreFiles = async (slice: Slice, dir: string): Promise<number> => {
  if (slice.manifest.files.length === 0) return 0;
  const storage = await import("@core/services/storage");
  let restored = 0;
  for (const file of slice.manifest.files) {
    const body = fs.readFileSync(path.join(dir, file.path));
    const contentType = file.path.endsWith(".png")
      ? "image/png"
      : file.path.endsWith(".pdf")
        ? "application/pdf"
        : "application/octet-stream";
    await storage.uploadObject(file.key, body, contentType);
    restored += 1;
  }
  return restored;
};

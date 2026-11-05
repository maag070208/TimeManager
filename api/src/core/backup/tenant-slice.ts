import { createHash } from "node:crypto";

/**
 * Utilidades puras del respaldo por cliente (F4-04): parseo de argumentos,
 * orden de restaurar por dependencias, hashes estables y validaciones de
 * seguridad. Viven en `src/core/backup` para poder probarlas sin base de datos;
 * la parte que toca Postgres/S3 está en `api/scripts/lib/tenant-backup.ts`.
 */

export type BackupCommand = "export" | "restore" | "verify";

export interface BackupArgs {
  command: BackupCommand | null;
  tenant: string | null;
  out: string | null;
  input: string | null;
  databaseUrl: string | null;
  s3: boolean;
  replace: boolean;
  allowRemote: boolean;
  bypassTriggers: boolean;
  help: boolean;
  port: string | null;
}

const COMMANDS = new Set<BackupCommand>(["export", "restore", "verify"]);
const BOOLEAN_FLAGS = new Set(["s3", "replace", "allow-remote", "bypass-triggers", "help"]);

/** `--clave=valor`, `--flag` y el comando posicional (`export|restore|verify`). */
export const parseBackupArgs = (argv: readonly string[]): BackupArgs => {
  const args: BackupArgs = {
    command: null,
    tenant: null,
    out: null,
    input: null,
    databaseUrl: null,
    s3: false,
    replace: false,
    allowRemote: false,
    bypassTriggers: false,
    help: false,
    port: null,
  };

  for (const raw of argv) {
    if (!raw.startsWith("--")) {
      const candidate = raw as BackupCommand;
      if (!COMMANDS.has(candidate)) throw new Error(`Comando desconocido: ${raw}`);
      if (args.command) throw new Error("Solo se admite un comando");
      args.command = candidate;
      continue;
    }
    const [flag, ...rest] = raw.slice(2).split("=");
    const value = rest.length > 0 ? rest.join("=") : null;
    if (BOOLEAN_FLAGS.has(flag)) {
      if (value !== null) throw new Error(`--${flag} no lleva valor`);
      if (flag === "s3") args.s3 = true;
      else if (flag === "replace") args.replace = true;
      else if (flag === "allow-remote") args.allowRemote = true;
      else if (flag === "bypass-triggers") args.bypassTriggers = true;
      else args.help = true;
      continue;
    }
    if (value === null || value === "") throw new Error(`--${flag} requiere valor (--${flag}=...)`);
    if (flag === "tenant") args.tenant = value;
    else if (flag === "out") args.out = value;
    else if (flag === "in") args.input = value;
    else if (flag === "database-url") args.databaseUrl = value;
    else if (flag === "port") args.port = value;
    else throw new Error(`Opción desconocida: --${flag}`);
  }

  return args;
};

/** Errores de uso del CLI; vacío = válido. */
export const validateBackupArgs = (args: BackupArgs): string[] => {
  if (args.help) return [];
  const errors: string[] = [];
  if (!args.command) errors.push("Falta el comando: export | restore | verify");
  if (args.command === "export") {
    if (!args.tenant) errors.push("export requiere --tenant=<slug|uuid>");
    if (!args.out) errors.push("export requiere --out=<directorio>");
  }
  if (args.command === "restore") {
    if (!args.input) errors.push("restore requiere --in=<directorio>");
    if (!args.databaseUrl) errors.push("restore requiere --database-url=<url>");
  }
  if (args.command === "verify") {
    if (!args.input) errors.push("verify requiere --in=<directorio>");
    if (!args.databaseUrl) errors.push("verify requiere --database-url=<url>");
  }
  return errors;
};

/** Host de loopback o Docker local: nunca una BD de la nube. */
export const isLocalDatabaseUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
};

/**
 * Restaurar es destructivo: por defecto solo se permite contra una BD local.
 * Para un restore real en producción hace falta `--allow-remote` explícito.
 */
export const assertRestoreTargetAllowed = (url: string, allowRemote: boolean): void => {
  if (isLocalDatabaseUrl(url)) return;
  if (allowRemote) return;
  throw new Error(
    "El restore solo se permite contra una BD local. Para una BD remota usa --allow-remote " +
      "después de verificar que es una BD limpia y que tienes respaldo de seguridad."
  );
};

/**
 * Orden de inserción: primero los padres, después los hijos (los FKs de
 * Postgres no se pueden diferir si no son DEFERRABLE). Los ciclos, si los hay,
 * se agregan al final para al menos reportar el error de FK de forma explícita.
 */
export const topologicalOrder = (
  tables: readonly string[],
  foreignKeys: readonly { child: string; parent: string }[]
): string[] => {
  const nodes = new Set(tables);
  const parentsOf = new Map<string, Set<string>>();
  const childrenOf = new Map<string, Set<string>>();
  for (const table of nodes) {
    parentsOf.set(table, new Set());
    childrenOf.set(table, new Set());
  }
  for (const fk of foreignKeys) {
    if (!nodes.has(fk.child) || !nodes.has(fk.parent) || fk.child === fk.parent) continue;
    parentsOf.get(fk.child)!.add(fk.parent);
    childrenOf.get(fk.parent)!.add(fk.child);
  }

  const pending = new Map<string, number>();
  for (const [table, parents] of parentsOf) pending.set(table, parents.size);

  const queue = [...nodes].filter((table) => pending.get(table) === 0).sort();
  const ordered: string[] = [];
  while (queue.length > 0) {
    const table = queue.shift()!;
    ordered.push(table);
    for (const child of [...(childrenOf.get(table) ?? [])].sort()) {
      const count = (pending.get(child) ?? 1) - 1;
      pending.set(child, count);
      if (count === 0) {
        queue.push(child);
        queue.sort();
      }
    }
  }

  if (ordered.length < nodes.size) {
    const remaining = [...nodes].filter((table) => !ordered.includes(table)).sort();
    ordered.push(...remaining);
  }
  return ordered;
};

/** JSON estable (claves ordenadas) para hashear filas sin depender del orden de Postgres. */
export const canonicalJson = (value: unknown): string => {
  const normalize = (item: unknown): unknown => {
    if (item === null || item === undefined) return item ?? null;
    if (typeof item === "bigint") return item.toString();
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(normalize);
    if (typeof item === "object") {
      const record = item as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) out[key] = normalize(record[key]);
      return out;
    }
    return item;
  };
  return JSON.stringify(normalize(value));
};

/** Hash del contenido de una tabla: suma estable de sus filas (sin importar orden). */
export const hashRows = (rows: readonly Record<string, unknown>[]): string => {
  const canonical = rows.map(canonicalJson).sort().join("\n");
  return createHash("sha256").update(canonical).digest("hex");
};

export interface TableManifest {
  table: string;
  columns: string[];
  count: number;
  sha256: string;
}

export interface FileManifest {
  /** Tabla y columna de donde salió la llave (`User.photoKey`, …). */
  table: string;
  column: string;
  key: string;
  /** Ruta relativa dentro de `files/`. */
  path: string;
  bytes: number;
}

export interface BackupManifest {
  version: 1;
  exportedAt: string;
  tenant: { id: string; slug: string; name: string };
  database: string;
  tables: TableManifest[];
  /** Filas de catálogos globales referenciados por el cliente (p. ej. `plans`). */
  prerequisites: TableManifest[];
  files: FileManifest[];
}

export const fileRelPath = (key: string): string => `files/${key.replace(/^\/+/, "")}`;

/** Compara el manifiesto con lo que se acaba de leer: devuelve diferencias legibles. */
export const compareManifests = (
  expected: readonly TableManifest[],
  actual: readonly TableManifest[]
): string[] => {
  const byTable = new Map(actual.map((entry) => [entry.table, entry]));
  const problems: string[] = [];
  for (const entry of expected) {
    const got = byTable.get(entry.table);
    if (!got) {
      problems.push(`${entry.table}: no se encontró al verificar`);
      continue;
    }
    if (got.count !== entry.count) {
      problems.push(`${entry.table}: esperaba ${entry.count} filas, hay ${got.count}`);
    }
    if (got.sha256 !== entry.sha256) {
      problems.push(`${entry.table}: el contenido no coincide (sha256 distinto)`);
    }
  }
  return problems;
};

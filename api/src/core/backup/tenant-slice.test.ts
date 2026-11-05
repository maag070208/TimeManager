import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertRestoreTargetAllowed,
  canonicalJson,
  compareManifests,
  hashRows,
  isLocalDatabaseUrl,
  parseBackupArgs,
  topologicalOrder,
  validateBackupArgs,
} from "./tenant-slice";

test("parseBackupArgs: comando posicional, --clave=valor y flags", () => {
  const args = parseBackupArgs([
    "export",
    "--tenant=acme",
    "--out=/tmp/backup",
    "--s3",
  ]);
  assert.equal(args.command, "export");
  assert.equal(args.tenant, "acme");
  assert.equal(args.out, "/tmp/backup");
  assert.equal(args.s3, true);
  assert.equal(args.replace, false);
  assert.deepEqual(validateBackupArgs(args), []);
});

test("parseBackupArgs: valores con '=' y rechazo de basura", () => {
  const args = parseBackupArgs([
    "restore",
    "--in=/tmp/a=b",
    "--database-url=postgresql://postgres:test@127.0.0.1:55433/tm_x",
  ]);
  assert.equal(args.input, "/tmp/a=b");
  assert.match(args.databaseUrl ?? "", /tm_x/);
  assert.throws(() => parseBackupArgs(["export", "--nope=1"]), /Opción desconocida/);
  assert.throws(() => parseBackupArgs(["otro"]), /Comando desconocido/);
  assert.throws(() => parseBackupArgs(["export", "--s3=1"]), /no lleva valor/);
});

test("validateBackupArgs exige los datos de cada comando", () => {
  assert.deepEqual(validateBackupArgs(parseBackupArgs([])), [
    "Falta el comando: export | restore | verify",
  ]);
  assert.deepEqual(validateBackupArgs(parseBackupArgs(["export"])), [
    "export requiere --tenant=<slug|uuid>",
    "export requiere --out=<directorio>",
  ]);
  assert.deepEqual(validateBackupArgs(parseBackupArgs(["restore"])), [
    "restore requiere --in=<directorio>",
    "restore requiere --database-url=<url>",
  ]);
  assert.deepEqual(validateBackupArgs(parseBackupArgs(["--help"])), []);
});

test("restore solo contra BD local salvo --allow-remote", () => {
  assert.equal(isLocalDatabaseUrl("postgresql://postgres:test@127.0.0.1:55433/tm_test"), true);
  assert.equal(isLocalDatabaseUrl("postgresql://postgres:x@localhost:5432/db"), true);
  assert.equal(isLocalDatabaseUrl("postgresql://user:pass@db.railway.app:5432/railway"), false);
  assert.throws(
    () => assertRestoreTargetAllowed("postgresql://user:pass@db.railway.app:5432/railway", false),
    /solo se permite contra una BD local/
  );
  assert.doesNotThrow(() =>
    assertRestoreTargetAllowed("postgresql://postgres:test@127.0.0.1:55433/tm_x", false)
  );
  assert.doesNotThrow(() =>
    assertRestoreTargetAllowed("postgresql://user:pass@db.railway.app:5432/railway", true)
  );
});

test("topologicalOrder: padres antes que hijos, sin duplicados ni huérfanos", () => {
  const order = topologicalOrder(
    ["agent_jobs", "agents", "tenants", "time_clocks", "time_clock_punches"],
    [
      { child: "agents", parent: "tenants" },
      { child: "agent_jobs", parent: "agents" },
      { child: "time_clock_punches", parent: "time_clocks" },
      { child: "time_clocks", parent: "tenants" },
    ]
  );
  assert.equal(order[0], "tenants");
  assert.ok(order.indexOf("agents") < order.indexOf("agent_jobs"));
  assert.ok(order.indexOf("time_clocks") < order.indexOf("time_clock_punches"));
  assert.equal(new Set(order).size, order.length);
});

test("topologicalOrder: ciclos no pierden tablas", () => {
  const order = topologicalOrder(
    ["a", "b", "c"],
    [
      { child: "a", parent: "b" },
      { child: "b", parent: "a" },
    ]
  );
  assert.deepEqual([...order].sort(), ["a", "b", "c"]);
});

test("canonicalJson/hashRows son estables e insensibles al orden de filas", () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.equal(canonicalJson({ at: new Date("2026-11-05T00:00:00.000Z") }), '{"at":"2026-11-05T00:00:00.000Z"}');
  assert.equal(canonicalJson({ big: BigInt(42) }), '{"big":"42"}');

  const rowsA = [
    { id: "2", name: "B" },
    { id: "1", name: "A" },
  ];
  const rowsB = [...rowsA].reverse();
  assert.equal(hashRows(rowsA), hashRows(rowsB));
  assert.notEqual(hashRows(rowsA), hashRows([{ id: "1", name: "A" }]));
});

test("compareManifests reporta faltantes, conteos y contenido distinto", () => {
  const base = [
    { table: "a", columns: ["id"], count: 2, sha256: "x" },
    { table: "b", columns: ["id"], count: 1, sha256: "y" },
  ];
  assert.deepEqual(compareManifests(base, base), []);
  assert.deepEqual(
    compareManifests(base, [
      { table: "a", columns: ["id"], count: 3, sha256: "x" },
      { table: "b", columns: ["id"], count: 1, sha256: "z" },
    ]),
    ["a: esperaba 2 filas, hay 3", "b: el contenido no coincide (sha256 distinto)"]
  );
  assert.deepEqual(compareManifests(base, []), [
    "a: no se encontró al verificar",
    "b: no se encontró al verificar",
  ]);
});

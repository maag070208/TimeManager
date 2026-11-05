/**
 * Plantilla Excel para la carga masiva de empleados (`GET /users/import/template`).
 * La descarga es binaria (.xlsx); el arnés decodifica el cuerpo como texto, así
 * que aquí se valida estatus/headers y la firma de archivo ZIP ("PK"); el
 * contenido exacto de la hoja se cubre en el unit de `UserImportService`.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  expectError,
  expectStatus,
  setupSuite,
  stopSuite,
} from "./harness";

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

describe("GET /users/import/template", () => {
  test("con users.create descarga un .xlsx adjunto con el formato", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const response = await api("GET", "/users/import/template", { token: admin.token });
    expectStatus(response, 200, "plantilla de importación");
    assert.match(
      String(response.headers.get("content-type")),
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
      "content-type de Excel"
    );
    assert.match(
      String(response.headers.get("content-disposition")),
      /attachment; filename="plantilla-usuarios\.xlsx"/,
      "se descarga como archivo"
    );
    assert.ok(Number(response.headers.get("content-length")) > 0, "trae contenido");
    assert.ok(response.text.startsWith("PK"), "el cuerpo es un .xlsx (ZIP)");
  });

  test("sin users.create responde 403", async () => {
    const tenant = await createTenant();
    const staff = await clientSession("CLIENT_STAFF", { tenant });

    const response = await api("GET", "/users/import/template", { token: staff.token });
    expectError(response, 403, "INSUFFICIENT_PERMISSIONS", "plantilla sin permiso");
  });

  test("sin sesión responde 401", async () => {
    const response = await api("GET", "/users/import/template");
    expectError(response, 401, "TOKEN_MISSING", "plantilla sin sesión");
  });
});

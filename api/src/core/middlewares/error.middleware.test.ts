/**
 * Respuestas de error: el 500 no filtra el mensaje interno y los errores
 * conocidos de Prisma no devuelven `meta` crudo. Sin BD: `HttpError`/Prisma se
 * construyen en memoria.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";

// `env.config` exige estas variables: son valores de unidad, sin BD real.
process.env.DATABASE_URL ??= "postgresql://postgres:test@127.0.0.1:55433/tm_test_errors";
process.env.PORT ??= "0";
process.env.JWT_SECRET ??= "unit-test-error-secret";

const middleware = async () => import("./error.middleware");

/** Request mínimo: el middleware solo lee método, ruta y Accept-Language. */
const requestOf = (overrides: Partial<Request> = {}): Request =>
  ({
    method: "POST",
    path: "/api/v1/demo",
    originalUrl: "/api/v1/demo",
    headers: {},
    ...overrides,
  }) as unknown as Request;

/** Response mínimo que captura el status y el body serializado por `json`. */
const responseOf = () => {
  const captured: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, captured };
};

test("un error inesperado responde 500 genérico, sin mensaje ni details internos", async () => {
  const { errorMiddleware } = await middleware();
  const error = new Error("fallo-interno-con-host-secreto:5432");
  const { res, captured } = responseOf();

  errorMiddleware(error, requestOf(), res, () => undefined);

  assert.equal(captured.status, 500);
  const body = captured.body as { code: string; message: string; details?: unknown };
  assert.equal(body.code, "INTERNAL_ERROR");
  assert.ok(body.message.length > 0);
  assert.equal(body.details, undefined);
  assert.ok(
    !JSON.stringify(captured.body).includes("fallo-interno-con-host-secreto"),
    "la respuesta no debe incluir el mensaje del error"
  );
});

test("P2025 responde 404 sin details (no expone err.meta)", async () => {
  const { errorMiddleware } = await middleware();
  const error = new Prisma.PrismaClientKnownRequestError("An operation failed because it depends on one or more records that were required but not found.", {
    code: "P2025",
    clientVersion: "test",
    meta: { modelName: "User", cause: "Record to update not found" },
  });
  const { res, captured } = responseOf();

  errorMiddleware(error, requestOf(), res, () => undefined);

  assert.equal(captured.status, 404);
  const body = captured.body as { code: string; details?: unknown };
  assert.equal(body.code, "RECORD_NOT_FOUND");
  assert.equal(body.details, undefined);
  assert.ok(
    !JSON.stringify(captured.body).includes("modelName"),
    "no debe salir metadata de Prisma"
  );
});

test("un HttpError conserva sus details (los usa la UI y los bots de QA)", async () => {
  const { errorMiddleware, HttpError } = await middleware();
  const error = new HttpError(409, "DUPLICATE_RECORD", {}, { expected: 5 });
  const { res, captured } = responseOf();

  errorMiddleware(error, requestOf(), res, () => undefined);

  assert.equal(captured.status, 409);
  const body = captured.body as { code: string; details?: unknown };
  assert.equal(body.code, "DUPLICATE_RECORD");
  assert.deepEqual(body.details, { expected: 5 });
});

type SupportBody = { code: string; message: string; supportCode?: string; details?: unknown };

test("un error inesperado lleva AX-04 al frente del mensaje, sin detalle técnico", async () => {
  const { errorMiddleware } = await middleware();
  const { res, captured } = responseOf();
  errorMiddleware(new TypeError("Cannot read properties of undefined"), requestOf(), res, () => undefined);
  const body = captured.body as SupportBody;
  assert.equal(body.supportCode, "AX-04");
  assert.match(body.message, /^\[AX-04\] /);
  assert.ok(!body.message.includes("Cannot read"));
});

test("sin conexión a la base (inicialización o P1001) responde 503 con AX-01", async () => {
  const { errorMiddleware } = await middleware();
  const init = new Prisma.PrismaClientInitializationError("Can't reach database server at `db.internal:5432`", "test", "P1001");
  const known = new Prisma.PrismaClientKnownRequestError("Can't reach database server", { code: "P1001", clientVersion: "test" });
  for (const error of [init, known]) {
    const { res, captured } = responseOf();
    errorMiddleware(error, requestOf(), res, () => undefined);
    const body = captured.body as SupportBody;
    assert.equal(captured.status, 503);
    assert.equal(body.code, "DATABASE_UNAVAILABLE");
    assert.equal(body.supportCode, "AX-01");
    assert.ok(!JSON.stringify(body).includes("reach"), "no sale el texto de Prisma");
  }
});

test("pool agotado o transacción vencida responde AX-02; otro error de Prisma, AX-03 sin su código", async () => {
  const { errorMiddleware } = await middleware();
  const pool = new Prisma.PrismaClientKnownRequestError("Timed out fetching a new connection", { code: "P2024", clientVersion: "test" });
  const other = new Prisma.PrismaClientKnownRequestError("Value out of range", { code: "P2020", clientVersion: "test" });
  const run = (error: Error) => {
    const { res, captured } = responseOf();
    errorMiddleware(error, requestOf(), res, () => undefined);
    return captured;
  };
  assert.equal((run(pool).body as SupportBody).supportCode, "AX-02");
  const failed = run(other);
  assert.equal(failed.status, 500);
  assert.equal((failed.body as SupportBody).supportCode, "AX-03");
  assert.ok(!JSON.stringify(failed.body).includes("P2020"), "el código de Prisma queda en el log");
});

test("los errores de negocio no llevan código de soporte", async () => {
  const { errorMiddleware, HttpError } = await middleware();
  const { res, captured } = responseOf();
  errorMiddleware(new HttpError(409, "DUPLICATE_RECORD"), requestOf(), res, () => undefined);
  const body = captured.body as SupportBody;
  assert.equal(body.supportCode, undefined);
  assert.doesNotMatch(body.message, /\[AX-/);
});

test("ruta inexistente responde AX-05 sin repetir método ni ruta", async () => {
  const { notFoundMiddleware } = await middleware();
  const { res, captured } = responseOf();
  notFoundMiddleware(requestOf({ originalUrl: "/api/v1/secreto" }), res, () => undefined);
  const body = captured.body as SupportBody;
  assert.equal(captured.status, 404);
  assert.equal(body.supportCode, "AX-05");
  assert.ok(!body.message.includes("/api/v1"));
});

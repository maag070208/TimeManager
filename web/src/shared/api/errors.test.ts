import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, errorMessage, toApiError, UserMessageError } from "./errors";

test("una respuesta del API se muestra tal cual, con su código de soporte", () => {
  const error = toApiError({
    response: { status: 503, data: { code: "DATABASE_UNAVAILABLE", supportCode: "AX-01", message: "[AX-01] Algo salió mal de nuestro lado." } },
  });
  assert.equal(error.status, 503);
  assert.equal(error.code, "DATABASE_UNAVAILABLE");
  assert.equal(error.supportCode, "AX-01");
  assert.equal(errorMessage(error), "[AX-01] Algo salió mal de nuestro lado.");
});

test("sin respuesta del servidor: AX-10, o AX-11 si se agotó el tiempo", () => {
  const offline = toApiError({ code: "ERR_NETWORK", message: "Network Error" });
  assert.equal(offline.supportCode, "AX-10");
  assert.match(offline.message, /^\[AX-10\] /);
  assert.ok(!offline.message.includes("Network Error"));

  const slow = toApiError({ code: "ECONNABORTED", message: "timeout of 30000ms exceeded" });
  assert.equal(slow.supportCode, "AX-11");
  assert.ok(!slow.message.includes("timeout of"));
});

test("una respuesta que no es del API: AX-12 si el servidor no está disponible, AX-13 si es otra cosa", () => {
  const gateway = toApiError({ message: "Request failed with status code 502", response: { status: 502, data: "<html>Bad Gateway</html>" } });
  assert.equal(gateway.supportCode, "AX-12");
  assert.ok(!gateway.message.includes("502"));

  const odd = toApiError({ response: { status: 418, data: { foo: 1 } } });
  assert.equal(odd.supportCode, "AX-13");
});

test("una excepción de JS nunca llega a la persona: AX-14 con el texto de la pantalla", () => {
  const crash = new TypeError("Cannot read properties of undefined (reading 'map')");
  assert.equal(errorMessage(crash, "No se pudo guardar."), "[AX-14] No se pudo guardar.");
  assert.match(errorMessage(crash), /^\[AX-14\] /);
  assert.ok(!errorMessage(crash).includes("Cannot read"));
});

test("una validación local se muestra tal cual", () => {
  assert.equal(errorMessage(new UserMessageError("Revisa las tablas.")), "Revisa las tablas.");
  assert.equal(errorMessage(new ApiError(409, "Ya existe.")), "Ya existe.");
});

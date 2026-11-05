import { test } from "node:test";
import assert from "node:assert/strict";
import { EMAIL_COMPANY_TOKEN, tenantWelcomeEmail, welcomeEmail } from "./email-templates";

test("bienvenida de cliente: nombre escapado, entrada, botón y pasos", () => {
  const { subject, html } = tenantWelcomeEmail({
    language: "es",
    company: "Acme <script>",
    name: "Ana",
    username: "admin",
    tempPassword: "Abc12345",
    loginUrl: "https://acme.timemanager.mx/login",
  });
  assert.equal(subject, "Acme <script> ya está en TimeManager");
  assert.ok(html.includes("Acme &lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes('href="https://acme.timemanager.mx/login"'));
  assert.ok(html.includes("Abc12345"));
  assert.ok(html.includes('<meta charset="utf-8" />'));
});

test("bienvenida de empleado: encabezado con el marcador del cliente y botón opcional", () => {
  const base = { language: "es" as const, to: "a@b.c", name: "Luis", username: "luis", tempPassword: "Temp1234" };
  const withUrl = welcomeEmail({ ...base, loginUrl: "http://demo.localhost:5006/login" });
  assert.ok(withUrl.html.includes(EMAIL_COMPANY_TOKEN));
  assert.ok(withUrl.subject.includes(EMAIL_COMPANY_TOKEN));
  assert.ok(withUrl.html.includes('href="http://demo.localhost:5006/login"'));
  assert.ok(!welcomeEmail(base).html.includes("<a href"));
});


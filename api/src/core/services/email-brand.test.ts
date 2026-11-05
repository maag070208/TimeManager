/**
 * Branding del correo por cliente (F3-05): nombre, color de acento y remitente
 * propio con fallback al `.env`. Funciones puras, sin envío real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://postgres:test@127.0.0.1:55433/tm_test";
process.env.PORT ??= "0";
process.env.JWT_SECRET ??= "unit-test-email-brand-secret";
process.env.RESEND_FROM_EMAIL ??= "no-reply@timemanager.test";

const loadQueue = () => import("./email-queue");
const loadMail = () => import("./mail");
const loadTemplates = () => import("./email-templates");

test("usa el nombre y color del cliente en el HTML y el asunto", async () => {
  const { applyBrandTokens } = await loadQueue();
  const { EMAIL_BRAND_COLOR_TOKEN, EMAIL_COMPANY_TOKEN } = await loadTemplates();

  const html = `<b>${EMAIL_COMPANY_TOKEN}</b><i>${EMAIL_BRAND_COLOR_TOKEN}</i>`;
  const branded = applyBrandTokens(html, { name: "Acme <HR>", color: "#1a2b3c" }, { escape: true });
  assert.equal(branded, "<b>Acme &lt;HR&gt;</b><i>#1a2b3c</i>");

  const subject = applyBrandTokens(`Bienvenido a ${EMAIL_COMPANY_TOKEN}`, { name: "Acme", color: null }, { escape: false });
  assert.equal(subject, "Bienvenido a Acme");
});

test("sin branding usa la marca y el acento de TimeManager", async () => {
  const { applyBrandTokens } = await loadQueue();
  const { EMAIL_BRAND_COLOR_TOKEN, EMAIL_COMPANY_TOKEN, EMAIL_DEFAULT_BRAND_COLOR } = await loadTemplates();

  const branded = applyBrandTokens(
    `${EMAIL_COMPANY_TOKEN}|${EMAIL_BRAND_COLOR_TOKEN}`,
    { name: null, color: null },
    { escape: true }
  );
  assert.equal(branded, `TimeManager|${EMAIL_DEFAULT_BRAND_COLOR}`);
});

test("las plantillas llevan el token del color del cliente", async () => {
  const { welcomeEmail } = await loadTemplates();
  const { EMAIL_BRAND_COLOR_TOKEN } = await loadTemplates();
  const { html } = welcomeEmail({
    language: "es",
    to: "a@b.c",
    name: "Luis",
    username: "luis",
    tempPassword: "Temp1234",
  });
  assert.ok(html.includes(EMAIL_BRAND_COLOR_TOKEN));
  assert.equal(html.includes("#5fb8dd"), false, "el acento ya no va hardcodeado");
});

test("remitente: emailFrom del cliente > .env; respeta un From con nombre", async () => {
  const { resolveFromHeader } = await loadMail();

  assert.equal(
    resolveFromHeader("rh@acme.mx", "Acme"),
    "Acme <rh@acme.mx>"
  );
  assert.equal(
    resolveFromHeader(null, "Acme"),
    "Acme <no-reply@timemanager.test>",
    "fallback al remitente del .env"
  );
  assert.equal(
    resolveFromHeader("Acme RH <rh@acme.mx>", "Acme"),
    "Acme RH <rh@acme.mx>",
    "un From ya formateado se respeta"
  );
});

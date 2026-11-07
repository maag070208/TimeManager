/**
 * Capturas de marketing para la landing con los datos demo (`pnpm demo:seed`).
 * Recorta por bloque (no por coordenadas), convierte a WebP en el propio
 * Chromium (más una variante de 960 px para `srcset`) y escribe un
 * manifiesto con ancho/alto para los <img>.
 *
 *   node scripts/capture-landing.mjs [web-base] [--only=a,b] [--hide-chrome]
 *   (web-base sin subdominio, p. ej. http://localhost:5019)
 *
 * `og-image` toma la propia landing pública (1200×630, JPEG) para redes.
 *
 * Las tomas con `punch` registran la entrada web del día con ubicación si la
 * persona aún no checa: escribe en la BD demo, nunca correrlo contra la nube.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { login, settle } from "./lib/demo-session.mjs";

const args = process.argv.slice(2);
const base = args.find((arg) => !arg.startsWith("--")) ?? "http://localhost:5019";
const only = args.find((arg) => arg.startsWith("--only="))?.slice(7).split(",");
const hideChromeAll = args.includes("--hide-chrome");

const OUT_DIR = path.resolve("public/landing/shots");
const MANIFEST = path.resolve("src/pages/landing/shots.json");
const MAX_WIDTH = 2000;
const SMALL_WIDTH = 960;
const QUALITY = 0.86;
const BROKEN = /Cargando|Consultando|Leyendo|no configurado|Sin conexión|No se pudo|Ocurrió un error|Something went wrong/i;

const CONTENT = "main > div > div";
const DEMO_GEO = { latitude: 19.4954, longitude: -99.1451, accuracy: 18 };

/**
 * target:
 *   { content: true, maxHeight }        contenedor de la pantalla, recortado en alto
 *   { card: "texto" }                   tarjeta (ITCard) que contiene el texto
 *   { closest: "selector", text }       ancestro más cercano del texto que cumple el selector
 *   { selector }                        primer elemento que cumple el selector
 */
const SHOTS = [
  { file: "hero-home", tenant: "altamira", user: "ricardo.salinas", route: "/", target: { content: true, maxHeight: 820 } },
  {
    file: "hero-mobile-jornada",
    tenant: "altamira",
    user: "karla.nunez",
    route: "/mi-jornada",
    viewport: { width: 390, height: 844 },
    target: { viewport: true },
    punch: true,
  },
  { file: "mi-jornada-map", tenant: "altamira", user: "karla.nunez", route: "/mi-jornada", target: { content: true, maxHeight: 940 }, map: true, punch: true },
  {
    file: "landing-map-cut",
    tenant: "altamira",
    user: "karla.nunez",
    route: "/mi-jornada",
    target: { within: "Ubicación de tu última checada web", selector: "div.rounded-2xl" },
    map: true,
    punch: true,
  },
  { file: "attendance-week", tenant: "altamira", user: "ricardo.salinas", route: "/hr/time-clock/entries-exits", target: { content: true, maxHeight: 900 } },
  { file: "overtime-lft", tenant: "altamira", user: "ricardo.salinas", route: "/schedules/overtime/approval", target: { card: "Horas extra por semana" } },
  { file: "payroll", tenant: "altamira", user: "ricardo.salinas", route: "/schedules/payroll", target: { content: true, maxHeight: 900 } },
  { file: "payroll-history", tenant: "altamira", user: "ricardo.salinas", route: "/schedules/payroll/history", target: { content: true, maxHeight: 760 } },
  { file: "schedules", tenant: "altamira", user: "ricardo.salinas", route: "/schedules", target: { content: true, maxHeight: 820 } },
  { file: "schedule-assign", tenant: "altamira", user: "ricardo.salinas", route: "/schedules/assign", target: { content: true, maxHeight: 820 } },
  { file: "telework", tenant: "santalucia", user: "lucia.arellano", route: "/teletrabajo", target: { content: true, maxHeight: 820 } },
  { file: "employee-records", tenant: "altamira", user: "ricardo.salinas", route: "/employees/records", target: { content: true, maxHeight: 820 } },
  { file: "leave", tenant: "altamira", user: "ricardo.salinas", route: "/hr/leave", target: { content: true, maxHeight: 820 } },
  { file: "agreements", tenant: "altamira", user: "ricardo.salinas", route: "/hr/jornada-acuerdos", target: { content: true, maxHeight: 820 } },
  { file: "clocks", tenant: "altamira", user: "ricardo.salinas", route: "/time-clocks", target: { content: true, maxHeight: 760 } },
  { file: "clock-dashboard", tenant: "altamira", user: "ricardo.salinas", route: "/time-clocks/dashboard", target: { content: true, maxHeight: 860 }, waitGone: /Consultando/i },
  { file: "payroll-settings", tenant: "altamira", user: "ricardo.salinas", route: "/payroll/settings", target: { content: true, maxHeight: 820 } },
  { file: "og-image", og: true, route: "/landing", viewport: { width: 1200, height: 630 }, target: { viewport: true } },
];

const CLEAN_CSS = `
  *::-webkit-scrollbar { display: none !important; }
  * { scrollbar-width: none !important; caret-color: transparent !important; }
  [data-sonner-toaster], .Toastify { display: none !important; }
`;

/** Oculta todo lo que no esté en la cadena de ancestros de <main> (sidebar, topbar). */
const hideChrome = (page) =>
  page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return;
    let node = main;
    while (node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) sibling.style.display = "none";
      }
      node = node.parentElement;
    }
  });

/** Registra la entrada web con ubicación si el siguiente paso del día es la entrada. */
const punchEntryIfPending = async (page) => {
  const entry = page.getByRole("button", { name: /Registrar Entrada/i });
  if (!(await entry.count())) return;
  await page.getByText(/Opciones de marcaje/).click();
  await page.getByLabel(/Compartir ubicación/).check();
  await entry.click();
  await entry.waitFor({ state: "detached", timeout: 15000 });
  await page.reload();
};

/** Marca el elemento a recortar con data-shot y devuelve su texto para validarlo. */
const markTarget = (page, target) =>
  page.evaluate(
    ({ target, content }) => {
      document.querySelectorAll("[data-shot]").forEach((el) => el.removeAttribute("data-shot"));
      const cardOf = (el) => el.closest("div.overflow-hidden.flex.flex-col, .tm-hero-card");
      const byText = (text) =>
        [...document.querySelectorAll("main *")].find((el) => el.childElementCount === 0 && el.textContent?.includes(text));
      let el = null;
      if (target.content) el = document.querySelector(content);
      else if (target.card) el = cardOf(byText(target.card) ?? document.body);
      else if (target.within) el = cardOf(byText(target.within) ?? document.body)?.querySelector(target.selector);
      else if (target.selector) el = document.querySelector(target.selector);
      if (!el) return null;
      el.setAttribute("data-shot", "1");
      if (target.maxHeight) {
        el.style.maxHeight = `${target.maxHeight}px`;
        el.style.overflow = "hidden";
      }
      el.scrollIntoView({ block: "start" });
      return el.innerText;
    },
    { target, content: CONTENT }
  );

/** PNG → WebP (o JPEG) con canvas de Chromium; reescala si pasa del ancho máximo. */
const encode = (page, png, type = "image/webp", maxWidth = MAX_WIDTH) =>
  page.evaluate(
    async ({ b64, maxWidth, quality, type }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { data: canvas.toDataURL(type, quality).split(",")[1], width: canvas.width, height: canvas.height };
    },
    { b64: png.toString("base64"), maxWidth, quality: QUALITY, type }
  );

fs.mkdirSync(OUT_DIR, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
const browser = await chromium.launch();
const failures = [];

for (const shot of SHOTS.filter((item) => !only || only.includes(item.file))) {
  const context = await browser.newContext({
    viewport: shot.viewport ?? { width: 1600, height: 1000 },
    deviceScaleFactor: shot.og ? 1 : 2,
    locale: "es-MX",
    reducedMotion: "reduce",
    isMobile: Boolean(shot.viewport && shot.viewport.width < 768),
    hasTouch: Boolean(shot.viewport && shot.viewport.width < 768),
    geolocation: DEMO_GEO,
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  try {
    const root = shot.og ? base : await login(page, { base, tenant: shot.tenant, username: shot.user });
    await page.goto(`${root}/#${shot.route}`);
    await settle(page, 1800);
    if (shot.punch) {
      await punchEntryIfPending(page);
      await settle(page, 1800);
    }
    if (shot.map) {
      await page
        .waitForFunction(
          () =>
            document.querySelector('iframe[src*="openstreetmap"]') ||
            [...document.images].filter((img) => img.src.includes("googleapis.com/maps/vt") && img.complete && img.naturalWidth).length >= 6,
          null,
          { timeout: 30000 }
        )
        .catch(() => {});
      await page.waitForTimeout(2500);
    }
    if (shot.waitGone) {
      await page.waitForFunction((src) => !new RegExp(src, "i").test(document.body.innerText), shot.waitGone.source, { timeout: 20000 }).catch(() => {});
      await settle(page, 800);
    }
    await page.addStyleTag({ content: CLEAN_CSS });
    if (hideChromeAll || shot.hideChrome) await hideChrome(page);

    let png;
    let text;
    if (shot.target.viewport) {
      text = await page.evaluate(() => document.body.innerText);
      png = await page.screenshot({ type: "png" });
    } else {
      text = await markTarget(page, shot.target);
      if (text === null) throw new Error("no se encontró el bloque");
      await page.waitForTimeout(400);
      png = await page.locator("[data-shot]").screenshot({ type: "png", animations: "disabled" });
    }
    const broken = text.match(BROKEN);
    if (broken) throw new Error(`el bloque dice «${broken[0]}»`);

    const image = await encode(page, png, shot.og ? "image/jpeg" : "image/webp");
    const target = shot.og ? path.join(OUT_DIR, "..", `${shot.file}.jpg`) : path.join(OUT_DIR, `${shot.file}.webp`);
    fs.writeFileSync(target, Buffer.from(image.data, "base64"));
    if (!shot.og) manifest[shot.file] = { width: image.width, height: image.height };
    if (!shot.og && image.width > SMALL_WIDTH) {
      const small = await encode(page, png, "image/webp", SMALL_WIDTH);
      fs.writeFileSync(path.join(OUT_DIR, `${shot.file}-${SMALL_WIDTH}.webp`), Buffer.from(small.data, "base64"));
    }
    console.log(`✓ ${path.basename(target)} ${image.width}×${image.height} ${Math.round((image.data.length * 0.75) / 1024)} KB`);
  } catch (error) {
    failures.push(shot.file);
    console.log(`✗ ${shot.file}: ${error.message}`);
  } finally {
    await context.close();
  }
}

await browser.close();
fs.writeFileSync(MANIFEST, `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2)}\n`);
if (failures.length) {
  console.log(`\nSin publicar (${failures.length}): ${failures.join(", ")}`);
  process.exitCode = 1;
}

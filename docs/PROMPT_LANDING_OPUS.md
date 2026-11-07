# Prompt para Opus 5.5 — actualizar la landing pública de CheckLab

Actúa como **ingeniero frontend senior + diseñador de producto**. Trabaja directo en el repo
`/Users/axzy/DEV/AXZY/TimeManager`. No pidas confirmación para cambios de UI: implementa,
verifica en navegador y entrega el resultado funcionando.

## Objetivo

Actualizar la landing pública de **CheckLab** (`web/src/pages/landing/`) para vender el producto
**real** que ya existe, usando **capturas nuevas de la app con datos demo** y un layout bento
consistente con la marca. La landing actual quedó desactualizada: habla de funciones viejas y no
muestra las pantallas nuevas (checada web con mapa, tabs de Mi jornada, dashboard de relojes,
horarios de 7 días, asignación en dos columnas, salarios en pre-nómina, etc.).

## 1. Lee antes de tocar código

1. `AGENTS.md`
2. `docs/PLAN_LANDING.md` — plan vigente, hallazgos y decisiones abiertas.
3. `web/src/pages/landing/LandingPage.tsx`, `ui/BentoCells.tsx`, `ui/HeroConsole.tsx`, `landing.css`.
4. `web/scripts/capture-screens.mjs` — pipeline de capturas existente.
5. `docs/DEMO_DATA.md` — empresas y cuentas demo; **úsalas, no inventes datos**.
6. `docs/QA_MATRIX.md` — inventario real de pantallas y funciones.
7. `web/src/app/main.tsx`, `web/src/app/index.css`, tokens de marca y `web/src/shared/assets/brand/`.

## 2. Contexto de producto que la landing debe reflejar

CheckLab es control de asistencia + RH + pre-nómina multiempresa. Marca: navy `#1D2636`, blanco
`#F4F6FA`, mint `#34D399` (texto mint oscuro `#0E9F6E`), ámbar `#F59E0B`. Logo/símbolo y lotties
oficiales ya están en `web/src/shared/assets/brand` y `web/src/shared/assets/lottie`.

Funciones nuevas que deben aparecer (con captura real cuando exista pantalla):

- **Checada web/app sin reloj físico**, pensada para clientes que no compran reloj:
  - entrada → salida a comer → regreso → salida;
  - ubicación GPS **por marcaje** (latitud/longitud/precisión), sin rastreo continuo;
  - mapa de la checada (Google Maps; fallback OpenStreetMap);
  - `Mi jornada` ahora organizada por tabs: **Mi checada / Teletrabajo / Registro y horas extra / Vacaciones y permisos**;
  - las checadas web cuentan para asistencia y pre-nómina, no sólo las del reloj.
- **Relojes**: dashboard con tabs Estado/Personas/Eventos/Cámara/Lector/Relojes, estado en línea/offline,
  alertas, padrón, vinculación reloj↔persona y agente local.
- **Horarios**: formulario de 7 días, descansos, turnos nocturnos, validación legal y aviso de reemplazo;
  asignación en dos columnas con flechas y una sola asignación vigente por persona.
- **Tiempo extra LFT**: dobles, triples, excedente ilegal y confirmación semanal.
- **Pre-nómina**: costo de plantilla, sueldo diario por persona, revisión por departamento,
  cierre con snapshot y reapertura.
- **Puestos de nómina** y salarios; catálogos; expedientes/documentos; vacaciones; convenios;
  teletrabajo NOM-037; roles/permisos; auditoría inmutable; consola multi-cliente.

No inventes testimonios, logos de clientes ni cifras de prueba social. Las empresas demo pueden
aparecer **sólo dentro de las capturas**, rotuladas como datos de demostración.

## 3. Capturas reales (obligatorio)

Primero levanta el stack y siembra datos demo:

```bash
pnpm install
pnpm demo:seed
pnpm dev
# web: http://localhost:5009   api: http://localhost:4011/api/v1
```

Lee `docs/DEMO_DATA.md` para las cuentas. Usa el navegador real, no maquetas.

### Pipeline

- Extiende `web/scripts/capture-screens.mjs` con un modo `--marketing` (o crea
  `web/scripts/capture-landing.mjs` reutilizando su login/Playwright):
  - `deviceScaleFactor: 2`, viewport 1600×1000;
  - recorte por **selector del bloque** (no coordenadas fijas);
  - exporta **WebP** a `web/public/landing/shots/`;
  - nombres estables y descriptivos (`hero-home.webp`, `overtime-lft.webp`, …);
  - `loading="lazy"` no aplica al script, pero el componente sí debe usarlo;
  - opción `--hide-chrome` para ocultar sidebar/topbar si el recorte lo requiere;
  - si una pantalla depende de Google Maps, configura `VITE_GOOGLE_MAPS_API_KEY` en `web/.env.local`
    (o documenta el fallback OSM).
- Cada captura debe salir **nítida, sin scrollbars, sin estados de error, sin “cargando”** y con datos
  demo coherentes. Si una pantalla falla por falta de S3 o hardware, usa una pantalla equivalente o
  documenta el fallback; **no publiques una captura rota**.

### Set mínimo de capturas

| Archivo | Ruta | Rol / nota |
|---|---|---|
| `hero-home.webp` | `/` | Inicio del cliente con KPIs y pendientes |
| `hero-mobile-jornada.webp` | `/mi-jornada` | Vista móvil de Mi jornada, tab Mi checada |
| `mi-jornada-map.webp` | `/mi-jornada` | Checada web con mapa de ubicación visible |
| `attendance-week.webp` | `/hr/time-clock/entries-exits` | Rejilla semanal de asistencia |
| `overtime-lft.webp` | `/schedules/overtime/approval` | Dobles/triples/excedente |
| `payroll.webp` | `/schedules/payroll` | KPIs, costo y revisión de pre-nómina |
| `payroll-history.webp` | `/schedules/payroll/history` | Cierres con snapshot |
| `schedules.webp` | `/schedules` | Horarios con semana L-D |
| `schedule-assign.webp` | `/schedules/assign` | Dos columnas con flechas |
| `telework.webp` | `/teletrabajo` | Política NOM-037/checklists |
| `employee-records.webp` | `/employees/records` | Expedientes y faltantes |
| `leave.webp` | `/hr/leave` | Bandeja de permisos |
| `agreements.webp` | `/hr/jornada-acuerdos` | Convenio art. 58 / método de registro |
| `clocks.webp` | `/time-clocks` | Relojes y agente |
| `clock-dashboard.webp` | `/time-clocks/dashboard` | Estado, alertas, personas |
| `payroll-settings.webp` | `/payroll/settings` | Puestos y salarios |
| `landing-map-cut.webp` | `/mi-jornada` | Recorte del mapa para la celda de checada web |

Además, optimiza: WebP, ancho máximo 1600–2000 px, peso total de la landing < 2.5 MB, `width`/`height`
explícitos en cada `<img>` para evitar CLS.

## 4. Rediseño de la landing

Mantén la estructura de conversión actual (nav, hero, bento, recorrido, cumplimiento, cómo funciona,
planes, FAQ, CTA, footer) pero **reescribe el contenido y las celdas** para que la historia sea:

> checar (reloj o web con mapa) → ver el día → horas extra legales → cerrar pre-nómina → prueba ante la autoridad

Requisitos visuales:

- Bento real en 12 columnas, radios 16–24 px, bordes `#eef1f5`, sombra suave.
- **Capturas reales** en las celdas principales; mini-interfaces sólo para flujos sin pantalla
  fotogénica (reloj → agente → nube; transición 48→40 h).
- Hero: titular fuerte, bajada clara, CTA principal y secundario; composición con `hero-home` y
  teléfono con `hero-mobile-jornada`, más una tarjeta flotante de “Checada web registrada” con
  pin de ubicación.
- Bloque oscuro de cumplimiento (navy) con lista de obligaciones y nota legal honesta.
- Planes con los precios reales del catálogo demo (`Esencial`, `Profesional`, `Empresa`) y nota
  “precios de referencia”; si el usuario no los quiere publicar, usa “Cotiza” y déjalo documentado.
- Tipografía en px (no depender del 80% global de la app); H1 mínimo 56 px desktop / 36 px móvil.
- Responsive real a 1440, 1024, 768 y 390 px; sin scroll horizontal.
- `prefers-reduced-motion` respetado; foco visible; contraste AA.
- SEO: title/description/OG/Twitter propios de la landing, `og:image` nueva, canonical si aplica.
- No uses el toggle de tema si no está bien resuelto: la app es clara; el bloque de cumplimiento
  puede ser oscuro sin toggle global. Documenta la decisión.

## 5. Archivos y límites

Puedes tocar:

- `web/src/pages/landing/**` (página, celdas, hero, CSS, componentes de captura)
- `web/public/landing/**` (capturas WebP)
- `web/scripts/capture-screens.mjs` o un script nuevo de capturas
- `web/tests/e2e/landing.spec.ts` y `landing.mobile.spec.ts` (actualizar si cambian textos/estructura)
- `web/index.html` sólo si hace falta SEO global (preferible meta por landing con react-helmet-like o efecto DOM)
- `web/src/shared/ui/location-map` sólo si necesitas reutilizar el mapa en una captura/celda

No toques API, migraciones, `e2e-seed.ts`, autenticación ni otros módulos del producto. No agregues
dependencias pesadas si puedes resolver con lo existente.

## 6. Verificación obligatoria

1. `cd web && npx tsc -b` → 0 errores.
2. `cd web && npx eslint src/pages/landing scripts/capture-screens.mjs` → 0 errores.
3. Capturas generadas y visibles en la landing.
4. Revisión visual manual en 1440, 1024, 768 y 390 px; adjunta capturas de la landing final.
5. `cd web && node scripts/e2e-run.mjs tests/e2e/landing.spec.ts tests/e2e/landing.mobile.spec.ts --project=chromium` → verde.
6. Lighthouse mobile ≥ 90 en performance y ≥ 95 en accesibilidad (si el entorno lo permite; si no,
   mide con `npx lighthouse` y reporta).
7. `git status` limpio de artefactos temporales; sin `console.log` de debug.

## 7. Entregable final

- Landing actualizada y navegable en `http://localhost:5009/#/landing`.
- Capturas WebP en `web/public/landing/shots/` + script reproducible.
- Resumen de:
  - archivos tocados;
  - capturas y rutas;
  - decisiones de diseño/contenido;
  - resultados de `tsc`, lint, E2E y Lighthouse;
  - pendientes reales (si alguna captura no se pudo tomar por S3/reloj/hardware).
- No hagas commit salvo que el usuario lo pida.

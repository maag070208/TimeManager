# Estado del plan y pendientes — CheckLab

Documento de revisión previo a implementar los requerimientos nuevos (ruta por
cliente, 3 planes con límite de personal y `CheckLab Agent`). **No hay código
nuevo de estas tres cosas todavía**: este MD es la propuesta para que la apruebes.

Última actualización: 2026-11-05. Complementa a
[PLAN_IMPLEMENTACION.md](PLAN_IMPLEMENTACION.md) (el plan ejecutable),
[SAAS_PLAN.md](SAAS_PLAN.md) (decisiones) y [ARQUITECTURA.md](ARQUITECTURA.md) (escala).

---

## 1. Dónde estamos (hecho y verificado)

| Bloque | Estado | Evidencia |
|---|---|---|
| Multi-tenant (Fase 1a) | Cerrada | tenantId + extensión Prisma + JWT por subdominio + migración aplicada |
| Aislamiento entre clientes | Cerrado con regresión | 2 fugas corregidas (`$queryRaw` y `*OrThrow`); `tenancy.flow.test.ts` 13 casos |
| Escalada de roles (ADMIN/SUPPORT a clientes) | Cerrada | `ROLE_NOT_FOR_CLIENT` en alta, edición y consola; tests 16 |
| Personal y Usuarios en una sola pantalla | Cerrado | L-18; menú, rutas y diálogo de cuenta sobre la lista |
| Tests de integración API | **60/60** | login/sesión, Personal, tenancy, foto, Ably, credenciales del reloj |
| Tests unitarios API | **50/50** | incluye cifrado, token de foto, capability de Ably, scopeArgs |
| Foto y archivos privados (F1C-01) | Cerrado en código | token firmado 5 min, S3 presignado; **falta cerrar el bucket en AWS** |
| Ably por token (F1C-02) | Cerrado | `GET /notifications/ably-token` con capability `user:<id>` subscribe |
| Credenciales del reloj por reloj (F1B-10) | Cerrado | `TimeClock.username/passwordEncrypted` (AES-256-GCM), write-only |
| E2E web (arnés) | **Verde** | Playwright + stack local (API 4010, mock ISAPI 4801, Vite 5106, BD tm_e2e) |
| Matriz E2E | Publicada | [E2E_MATRIX.md](E2E_MATRIX.md): 48 filas pantalla×funcionalidad con estado |
| Repositorio | Limpio | commits `99aff19`, `e9af811`, `20cc36c`, `9247f8d` |

**En curso ahora mismo** (equipos de pruebas): suites E2E de Personal, móvil,
departamentos, horarios, tiempo extra/nómina, relojes, páginas de acceso, roles
y consola de clientes. La matriz ya marca qué cubre cada una.

Del plan ejecutable quedan **47 tareas** en `PLAN_IMPLEMENTACION.md`.

---

## 2. Requerimiento nuevo A — cada cliente con su propia ruta

### Lo que ya existe

Hoy el cliente se resuelve por **subdominio**: `acme.localhost:5106` en local,
`cliente.timemanager.mx` en producción (decisión D3). El login toma el slug del
host, el JWT lleva `tenantId` y la consola de plataforma permite entrar como
cliente. El dominio `timemanager.mx` está decidido (compra pendiente).

### Propuesta (recomendada)

| Opción | URL | Ventajas | Costos |
|---|---|---|---|
| **A. Subdominio (recomendada)** | `acme.timemanager.mx` | Aislamiento visual y de cookies, branding por cliente, ya implementado en código | DNS wildcard `*.timemanager.mx` + certificado wildcard |
| B. Ruta | `timemanager.mx/c/acme` | Sin DNS ni certificado extra | Hay que reescribir el login/resolución, QR y correos; cookies compartidas |
| C. Dominio propio | `checador.acme.mx` | Máxima marca blanca | Por cliente: DNS + cert + soporte |

Recomendación: **A ahora, C como add-on de plan alto**. “Ruta propia” se cumple
con el subdominio (la ruta interna de la app no cambia).

### Qué falta para producción (se propone como tarea nueva)

- **F3-08 Subdominio por cliente en producción**: DNS wildcard, certificado
  wildcard, `VITE_TENANT_BASE_DOMAIN=timemanager.mx`, CORS para `*.timemanager.mx`,
  enlaces de correo y QR de credencial con el host del cliente, y prueba de
  login por subdominio real.
- Consola: al crear un cliente mostrar su URL final (`acme.timemanager.mx`) y
  validar slugs reservados.
- Ajustar `WEB_ORIGIN` y el renderer de nginx/render-config para el dominio real.

---

## 3. Requerimiento nuevo B — 3 planes con límite de personal

### Estado actual

`Tenant` ya tiene `plan String?` y `employeeLimit Int?`, pero **no existe
catálogo de planes**: nada valida ni aplica el límite, y no hay precios. La
consola permite editar el límite a mano.

### Propuesta

| Clave | Nombre | Personal incluido | Precio |
|---|---|---|---|
| `PLAN_500` | Básico | 500 personas activas | **por definir** |
| `PLAN_750` | Profesional | 750 personas activas | **por definir** |
| `PLAN_1000` | Empresarial | 1000 personas activas | **por definir** |

Decisiones sugeridas (marcadas para tu aprobación):

1. **Qué cuenta como “personal”**: personas con cuenta activa en el cliente
   (`User.active = true AND tenantId = X`). Las bajas no cuentan.
2. **Qué pasa al llegar al límite**: el alta de personal y la importación se
   bloquean con un error claro (`EMPLOYEE_LIMIT_REACHED`) y la consola muestra
   “X / límite”. No se desactivan cuentas existentes.
3. **Relojes**: los planes no limitan relojes por ahora (o se agrega después
   como “máximo de relojes” por plan; dime si lo quieres ya).
4. **Cambio de plan**: bajar de plan por debajo del uso actual se permite pero
   avisa; no se borra nada.
5. **Cobro (D5)**: sigue pospuesto. El plan se registra como etiqueta y límite;
   Stripe/Conekta/manual se decide después sin bloquear.

### Tareas propuestas

- **F3-09 Catálogo de planes y límites**: modelo `Plan` (key, nombre, límite,
  precio opcional, activo) + `Tenant.plan` como FK + seed con los 3 planes;
  `employeeLimit` derivado del plan (o override explícito).
- **F3-10 Enforcement del límite**: helper `assertCanAddPeople(tenantId)`;
  aplicarlo en alta individual, importación Excel, y al crear el `CLIENT_ADMIN`
  del onboarding. Mensaje i18n y tests de integración (500/750/1000 borde).
- **F3-11 Consola de planes**: mostrar plan, uso y límite en la consola de
  plataforma; cambiar plan con confirmación; uso en la ficha del cliente.
- **F4-08 Uso y alertas por plan** (opcional): umbral 80/100 % con aviso al
  admin del cliente y a soporte.

---

## 4. Requerimiento nuevo C — `CheckLab Agent`

### Objetivo

App de **escritorio (Electron)** con nuestro design system
(`@axzydev/axzy_ui_system`) y tema CheckLab, instalada en una PC del cliente.
Es la que se conecta al **reloj Hikvision por la red local** (ISAPI), lee las
checadas y las envía al API; además ejecuta las órdenes de escritura sobre el
equipo (alta/baja de personas, tarjetas, huellas) que se piden desde la nube.
Se inspira en una app de escritorio de referencia (Electron + instaladores),
pero este agente **no** instala el stack completo: solo es el brazo local del
SaaS.

```
┌───────────── PC del cliente ─────────────┐
│  CheckLab Agent (Electron)             │
│   UI (estado, relojes, logs, ajustes)    │
│   Servicio local (Node)                  │
│     ├── ISAPI → reloj (sync checadas)    │
│     ├── cola local (reintentos)          │
│     └── HTTPS saliente → API SaaS        │
└──────────────────────────────────────────┘
              │
        Reloj en 192.168.x
```

### Por qué así

- El API en la nube **no alcanza** IPs privadas del cliente; el agente abre
  conexión saliente y resuelve el NAT sin VPN.
- Las **checadas** suben en lote y son idempotentes por
  `@@unique(clockSerial, serialNo)`: si el agente se cae o reintenta, no duplica.
- Las **escrituras** al reloj (padrón/huellas) llegan como trabajos en cola y el
  agente ejecuta con las credenciales del reloj que ya viven cifradas en la BD.
- La **estación de huellas** puede ser nuestra (central) o viajar con el agente,
  según el cliente (decisión ya tomada: “ambas según el cliente”).

### Decisiones para tu aprobación

1. **Transporte**: poll de trabajos cada N segundos (simple, robusto detrás de
   NAT) vs WebSocket persistente (más inmediato, más complejo). Recomiendo
   **long-poll/HTTPS cada 3–5 s** para el MVP.
2. **Credencial del agente**: token de dispositivo por cliente (revocable,
   rotable, ligado a un serial de agente), administrado desde la consola. No se
   reutiliza la contraseña del usuario.
3. **UI del agente**: estado del reloj, última sync, cola, botón “sincronizar
   ahora”, ajustes de red, logs exportables, auto-actualización. Con nuestro
   theme, sin pantallas de más.
4. **Distribución**: instalador Windows (principal) + AppImage Linux; firma y
   auto-update (electron-updater) en fase posterior.
5. **Alcance del MVP**: solo sincronizar checadas y ejecutar escrituras del
   padrón; sin gestión local de huellas ni reportes en la app.

### Tareas propuestas

- **F1B-14 Agente Electron (MVP)**: repo/app `timemanager-agent`, UI con
  `@axzydev/axzy_ui_system`, tema, login/registro con token de dispositivo,
  configuración de reloj(s), sync ISAPI + cola local, logs, auto-update.
- **F1B-15 Ingesta de checadas del agente**: `POST /agent/punches` (lote,
  idempotente), estado por lote y salud del agente (`lastSyncAt`, pendientes).
- **F1B-16 Cola de trabajos para el agente**: `GET /agent/jobs` (long-poll),
  `POST /agent/jobs/:id/result`, estados/reintentos, tipos: `SYNC`, `PERSON_ADD`,
  `PERSON_REMOVE`, `CARD_ADD`, `FINGERPRINT_APPLY`.
- **F1B-17 Credenciales de agente**: modelo `Agent` por tenant (nombre, token
  hash, versión, activo), rotación/revocación desde la consola, auditoría.
- **F3-12 Puesta en marcha del agente por cliente**: alta guiada en la consola
  (token, requisitos de red, prueba de conexión al reloj, checklist del
  instalador) que acompaña a F3-07 (alta guiada del reloj).

---

## 5. Lo que falta del plan actual (por fase)

| Fase | Pendientes | Nota |
|---|---|---|
| 1a | F1A-11 (login escritorio), F1A-12 (defensa en profundidad rutas plataforma) | F1A-11 lo absorbe el agente nuevo |
| 1b | F1B-01 RLS, 02 workers fuera, 03 cola, 04 TZ por cliente, 05 S3/Ably por tenant, 06 API key de reloj, 07 PgBouncer, 08 índices, 11 agente, 12 estación, 13 ingesta | Los relojes (10-13) son la prioridad de producto |
| 1c | F1C-03 API producción (rate limit, compression, SIGTERM), 04 artefacto+CI, 05 endpoints caros, 06 envs/docs | 04 es el bloqueante de despliegue |
| 2 | ✅ F2-01..05 implementados y probados; F2-06 espera disposiciones STPS | Ver PLAN_CIERRE_HUECOS_JORNADA.md |
| 3 | F3-03 entrar como cliente, 04 límites (→ F3-09/10), 05 branding, 06 subdominios, 07 reloj guiado | Se amplía con planes (F3-09..11) |
| 4 | F4-01 cobro, 02 rate limit/compression/cursor, 03 observabilidad, 04 backups, 05 k6, 06 CI | Depende de A1/A2 |
| 5 | F5-01 SSO, 02 BD por cliente, 03 SLA | Cuando lo pida un cliente |
| Limpieza | L-02..L-07, L-10..L-12, L-20 | Deuda heredada del ERP y rotación de Ably |

---

## 6. Orden recomendado (sprints)

| Sprint | Contenido | Sale con |
|---|---|---|
| **S1 — Cerrar seguridad/entrega** | F1C-01 bucket AWS (acción tuya), F1C-06 envs/docs, F1C-04 nginx.conf + CI, L-20 rotar Ably | Ningún archivo público; deploy reproducible |
| **S2 — Relojes y agente (MVP)** | F1B-11/13/14/15/16/17, F3-07, F3-12 | Un cliente con su reloj y su agente sincronizando checadas y ejecutando altas |
| **S3 — Planes y subdominios** | F3-08, F3-09, F3-10, F3-11 | Cliente nuevo en `cliente.timemanager.mx` con su plan y límite aplicado |
| **S4 — Operación/escala** | F1B-02, F1B-03, F1B-07, F1C-03, F1C-05, F4-02, F4-03, F4-05, F4-06 | 1000 concurrentes con SLO y dashboard de métricas |
| **S5 — NOM y cobro** | F2-01..06, D5, F4-01 | Expediente NOM vendible y cobro por plan |

Decisiones que sigo necesitando: **A1** (cola BullMQ vs pg-boss), **A2** (plan de
Postgres/Railway), **D5** (cobro), precios de los 3 planes, y si los planes
limitan también **número de relojes**.

---

## 7. Riesgos de los requerimientos nuevos

| Riesgo | Mitigación |
|---|---|
| Límite de personal mal aplicado deja entrar de más | `assertCanAddPeople` en todos los caminos de alta + test de integración por plan |
| Un cliente “baja” de plan y queda por encima del límite | Se permite operar, se avisa y se bloquean altas nuevas |
| El agente se cae y pierde checadas | Cola local persistente + idempotencia por `(clockSerial, serialNo)` + re-sync desde el cursor del reloj |
| Credencial del agente filtrada | Token revocable por cliente, hash en BD, rotación y auditoría |
| Reloj en red del cliente sin salida a internet en la PC | Checklist de instalación (F3-12) y prueba de conexión desde el agente |
| Subdominio wildcard mal configurado | Prueba de login real por subdominio antes de dar de alta al primer cliente |

---

## 8. Lo que propongo hacer en cuanto apruebes

1. Fusionar estas tareas en `PLAN_IMPLEMENTACION.md` (IDs F3-08..F3-12, F1B-14..F1B-17, F4-08).
2. Empezar por **S1** (lo que ya está en código y solo falta operación) y en
   paralelo el **MVP del agente** (F1B-14..17) porque es lo que desbloquea la
   instalación real en casa del cliente.
3. Planes y subdominios después, cuando definas precios y si hay límite de relojes.

**No se ha escrito código de estos tres requerimientos todavía.**

---

## 9. Decisiones tomadas (2026-11-05, llamada con el usuario)

- **Planes administrables**: el catálogo de planes se da de alta/baja/edita desde
  la consola de plataforma (nombre, límite de personal, **límite de relojes**,
  precio mensual editable). Arranque: 500/750/1000 personas y 1/2/3 relojes,
  precios de ejemplo 500/750/1000 (no definitivos).
- **Relojes por plan**: sí, 1/2/3 según plan.
- **Cola (A1) → cerrada**: `pg-boss` sobre Postgres (sin Redis por ahora).
- **Agente**: las checadas se suben **por chunks cada 15–30 s, configurable**
  (no tiempo real ni cada segundo). Hay Ably disponible para empujar avisos al
  agente. Instaladores **Windows + Linux**. Transporte: HTTP por lote + poll de
  trabajos; Ably como acelerador opcional.
- **Rutas por cliente (local)**: todo local con **rutas por cliente**:
  `http://localhost:5006/#/cliente1/home`, `/#/cliente2/home`. Producción real
  con dominio `axzy.dev` (wildcard o rutas, se define al publicar).
- **Base de datos**: la única remota es la **DEV de Railway**; se autoriza
  aplicar migraciones, seed y reiniciar. Las pruebas de cada ingeniero usarán
  Postgres local de Docker (misma versión/esquema) para no pisarse entre sí y
  para no truncar la DEV; al final se aplica migración + seed a Railway DEV y se
  verifica. (Si se requiere, se crean bases `tm_test`/`tm_e2e` en el servidor
  Railway para pruebas aisladas.)

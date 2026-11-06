# Arquitectura y escalamiento — API, base de datos y web

Cómo llevar CheckLab a miles de usuarios concurrentes sin reescribir el producto. Complementa a [SAAS_PLAN.md](SAAS_PLAN.md) (multi-cliente) con las decisiones técnicas de capacidad.

Base: análisis del repo al 2026-11-04. Cada sección marca **lo que ya está bien**, **lo que falta** y **cuándo hace falta** (fase del roadmap de SAAS_PLAN).

---

## 0. Cargas objetivo (números de diseño)

| Métrica | Supuesto | Volumen resultante |
|---|---|---|
| Empleados por cliente | 50 – 5,000 | — |
| Clientes (año 1) | 100 | 100k–500k empleados totales |
| Checadas | 4–6 por empleado/día | ~2M filas/día en 100 clientes medianos |
| Escrituras pico | 70% de checadas en ventanas de 30 min (entrada/salida) | ~200–500 escrituras/s en pico |
| Lecturas | dashboards, asistencia semanal, reportes | ~10× las escrituras |
| Usuarios concurrentes | 10% del personal de nómina + RH | miles en hora pico |

Conclusión: el problema no es el promedio, son los **picos de checada** (todos entran a las 8:00) y las **consultas de asistencia** (semanal × empleados × cálculo). El diseño se centra en esos dos.

---

## 1. API

### Ya está bien
- Express + módulos por dominio con factory, fácil de partir si hiciera falta.
- Helmet activo; JWT stateless → la API puede escalar horizontal sin sesiones pegajosas.
- Idempotencia de ingesta ya existe: `TimeClockPunch @@unique([clockSerial, serialNo])` descarta duplicados del reloj — base perfecta para una cola.

### Lo que falta (por impacto)

**1. Sacar los workers del proceso web — crítico antes de escalar réplicas.**
Hoy el sync de relojes y el roster corren como workers *dentro* del proceso API (`time-clock-roster.service.ts`, `time-clock.service.ts`). Con 2+ réplicas cada una correría su propio worker duplicado. Moverlos a procesos separados:

```
api/        → solo HTTP, stateless, N réplicas detrás del LB
workers/    → sync de relojes, roster, cálculo de asistencia, envío de correo
scheduler/  → 1 sola instancia (leader) que encola trabajos periódicos
```

Cola recomendada: **BullMQ + Redis** (ya hay Redis en el camino para caché; BullMQ da reintentos, backoff y rate limiting por tenant de gratis).

**2. Cola de ingesta de checadas.**
Los relojes empujan checadas en ráfagas en hora pico. En vez de escribir directo a Postgres desde el request: recibir → validar → encolar → responder 202 → worker inserta en lotes (`createMany`, que además aprovecha el `@@unique` para dedup). Esto aplana el pico de 500 esc/s a lo que la BD absorba cómodamente.

**3. Cálculo de asistencia como trabajo, no como request.**
`computeWorkday` y `weekly-attendance` son CPU-bound y se ejecutan por empleado × día. En SaaS: pre-calcular por la noche (job por tenant × semana → tabla de resultados materializada) y que la pantalla lea resultados. El cálculo on-demand queda solo para "hoy".

**4. Connection pooling: PgBouncer (transaction mode) + Prisma `connection_limit`.**
Postgres en la nube suele permitir ~100–400 conexiones; N réplicas × pool de Prisma las agota rápido. Regla: `réplicas × connection_limit ≤ 70% del máximo de la BD`, con PgBouncer delante cuando pasemos de ~5 réplicas.

**5. Middleware básico de producción que hoy no existe:**
- `compression` (gzip/br) — respuestas JSON de asistencia son grandes.
- Rate limiting por IP y por tenant (`express-rate-limit` + Redis store): protege login y la cola de ingesta.
- Paginación por cursor en todos los `POST /query` (varios usan offset o traen de más); límite máximo server-side.
- Timeouts y `helmet` ya; agregar límite de body y circuit breaker hacia relojes/S3/Ably.

**6. Observabilidad mínima viable.**
Winston ya está; falta: request-id por correlación, métricas (Prometheus: latencia por ruta, tamaño de cola, errores), tracing cuando haya 3+ servicios, y alertas sobre profundidad de cola de ingesta (si crece, las checadas se están atrasando).

---

## 2. Base de datos

### Índices que ya existen (bien)

| Tabla | Índices actuales |
|---|---|
| `time_clock_punches` | `@@unique([clockSerial, serialNo])` (dedup), `(occurredAt)`, `(employeeNumber, occurredAt)` |
| `access_events` | `(employeeId, occurredAt)`, `(occurredAt)`, `(siteId)`, `(guardId)`, `(type)` |
| `notifications` | `(userId, read)`, `(userId, createdAt desc)` |
| `audit_logs` | `(entityType, entityId)`, `(userId)`, `(createdAt)` |
| `schedule_assignments` | `(userId, validFrom, validTo)` |
| `email_logs` | `(status, nextAttemptAt)` (cola) |

### Lo que falta

**1. Índices compuestos con tenant (fase 1 del SaaS).**
Al agregar `tenantId`, el orden importa — tenant primero en los índices de consulta por cliente:

```prisma
@@index([tenantId, employeeNumber, occurredAt])  // punches
@@index([tenantId, employeeId, occurredAt])      // access_events
@@index([tenantId, userId, read])                // notifications
@@index([tenantId, createdAt])                   // audit_logs
```

**2. Particionado de las dos tablas calientes** (`time_clock_punches`, `access_events`): por rango mensual de `occurredAt`. Postgres declarativo lo hace sin cambiar la app; Prisma lo tolera leyendo la tabla padre. Cuándo: cuando una tabla pase de ~50M de filas o los vacuums/índices se degraden — no antes.

**3. Retención y archivado.** La NOM exige conservar, no conservar *caliente*. Política por tenant: 12 meses en tabla activa → tablas de archivo (misma BD) o export a S3 + borrado. Esto mantiene los índices chicos y los reportes del día a día rápidos.

**4. Réplica de lectura (fase 3–4).** Reportes, exportaciones y dashboards a la réplica; escrituras y "hoy" a la primaria. Prisma soporta múltiples clients; con la cola de reportes ya separada es un cambio acotado.

**5. RLS como red de seguridad** (ver SAAS_PLAN §3.2): `tenant_id = current_setting('app.tenant')` en todas las tablas de negocio; la app siempre setea la variable por conexión.

**6. Mantenimiento:** `pg_stat_statements` desde el día 1 para cazar las 10 queries más lentas; autovacuum afinado en las tablas de checadas (mucho insert + updates de índice); backups diarios + PITR del proveedor, con restore ensayado por tenant (fase 4).

---

## 3. Web

### Lo que está frenando hoy (arreglos inmediatos, fase 1)

`web/vite.config.ts` tiene el build **sin optimizar** (parece config de desarrollo aplicada a producción):

```ts
build: { modulePreload: false, target: "esnext", minify: false, cssCodeSplit: false }
```

Cambios directos para `build:prod`:
- `minify: true` (o `"esbuild"`) — hoy el bundle sale sin minificar.
- `cssCodeSplit: true` — CSS por ruta en vez de un monolito.
- `modulePreload` activado — precarga de chunks.
- `manualChunks` para separar vendors pesados: `react-pdf`, `ably`, `lottie`, `qrcode` no deben cargar en el login.

### Code splitting por ruta
Hoy el router no usa `React.lazy`: toda la app (PDFs, kanban, cámara, editor de horarios) carga en el primer bundle. Cada página de `pages/` debe ser `lazy()` con `Suspense`; las rutas de RH cargan cuando el usuario entra. Impacto típico: bundle inicial de varios MB → < 400 KB.

### Capa de datos
Ahora cada pantalla pega a la API vía axios + Redux sin caché: la misma asistencia semanal se recalcula y se re-descarga en cada visita. Adoptar **TanStack Query** (o RTK Query, ya está Redux) con:
- `staleTime` por tipo de dato (catálogos: minutos; asistencia de hoy: 30–60 s; checadas históricas: inmutable).
- Invalidación por eventos Ably en vez de polling.
- Prefetch al pasar el cursor sobre filas de tablas.

### Listas y render
- Tablas de empleados/checadas con **paginación del servidor** ya existente en la API + virtualización en cliente (`@tanstack/react-virtual`) cuando una vista deba mostrar miles de filas.
- PDFs (`@react-pdf/renderer`) generados en Web Worker o en el servidor para no congelar la UI.
- i18n y assets estáticos detrás de CDN con `cache-control` inmutable (Vite ya fingerprintea).

### Medición
Presupuesto de rendimiento por pantalla y Lighthouse CI en el build: LCP < 2.5 s, bundle inicial < 400 KB gzip. Sin medición, cada feature degrada un poco y en seis meses la app "se siente lenta" sin culpable.

---

## 4. Topología objetivo (SaaS, fases 3–4)

```
                 CDN (assets web)
                   │
              Load balancer
                   │
        ┌──────────┼──────────┐
     api × N   workers × M   scheduler × 1
        │          │
   PgBouncer    Redis (cola + caché + rate limit)
        │
   Postgres primaria ──► réplica de lectura (reportes)
        │
   S3 (fotos, documentos, exports)   Ably (realtime)
```

- **api × N**: stateless, escala por CPU/latencia.
- **workers × M**: escalan por profundidad de cola; separados por tipo (ingesta, cálculo, correo).
- **scheduler × 1**: líder único (lock en Redis) que encola periódicos.
- Todo lo externo (relojes, S3, Ably, correo) detrás de clientes con reintento y timeout — un reloj caído nunca tira la API.

---

## 5. Roadmap técnico (alineado con SAAS_PLAN)

| Fase | Trabajo de arquitectura |
|---|---|
| **1. Multi-tenant interno** | tenantId + índices compuestos, RLS, **sacar workers del proceso web**, PgBouncer, arreglar `build:prod` (minify/code-split), lazy routes, TanStack Query |
| **2. NOM** | Cola de ingesta de checadas, asistencia pre-calculada, archivado por retención |
| **3. Onboarding/planes** | Rate limiting por tenant, compresión, paginación cursor en todos los `/query`, presupuesto de performance + Lighthouse CI |
| **4. Operación** | Réplica de lectura, particionado si aplica, métricas/alertas, restore por tenant ensayado |
| **5. Enterprise** | BD dedicada por tenant, escaneo de `pg_stat_statements` por tenant, autoscaling de workers |

Regla general: **no optimizar antes de la fase que lo necesita**, pero sí dejar el gancho (cola, índice, cursor) puesto desde la fase anterior. Lo único que no espera: workers fuera del proceso web y el build de producción de la web — esos dos bloquean todo lo demás.

---

## 6. Decisiones abiertas

1. **Cola**: BullMQ + Redis (recomendado, un solo servicio nuevo) vs SQS/PubSub del proveedor.
2. **Caché de datos web**: TanStack Query (recomendado, estándar) vs RTK Query (menos dependencias, ya hay Redux).
3. **Asistencia pre-calculada**: ¿tabla materializada por día/empleado (recomendado) o vistas materializadas de Postgres con refresh?
4. **Proveedor de Postgres**: confirmar límites de conexiones y soporte de PgBouncer/particionado/RÉPLICAS en Railway/Render, o evaluar mover a RDS/Cloud SQL si el plan enterprise lo justifica.
5. **Métricas**: Prometheus + Grafana self-host vs servicio del proveedor (Better Stack, Datadog).

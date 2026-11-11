# Revisión de concurrencia y seguridad — objetivo 1,000 requests simultáneos

Fecha de revisión: 2026-11-09  
Alcance: revisión estática de la arquitectura del API, configuración, despliegue, pruebas de carga y controles de seguridad presentes en el repositorio.

> Esta revisión no sustituye una prueba de carga en staging, un pentest, una auditoría de dependencias ni una validación legal. Las casillas marcadas indican que el control se encontró en el código; no que esté correctamente configurado en producción.

## 1. Resumen ejecutivo

- **1,000 usuarios conectados:** es un escenario plausible, siempre que no generen 1,000 requests al mismo instante.
- **1,000 requests realmente simultáneos:** todavía no debe garantizarse. La arquitectura permite escalar sin reescribir el producto, pero no existe evidencia de carga a ese nivel.
- **Seguridad:** existe una buena base técnica, con aislamiento multi-cliente, permisos, RLS, cifrado y archivos privados. Antes de considerar el sistema endurecido para datos sensibles de RH deben cerrarse pendientes de sesiones, MFA, rate limiting distribuido, archivos y exposición de información.
- **Principal riesgo de capacidad:** Postgres y los reportes/cálculos pesados, no Express por sí solo.
- **Evidencia actual:** smoke local con concurrencia 5 y escenarios k6 con 10 VUs por defecto. No se encontró una ejecución documentada con 1,000 VUs.

### Semáforo general

| Área | Estado | Interpretación |
|---|---|---|
| Arquitectura base | Buena | API stateless, workers separables y escala horizontal posible |
| Evidencia para 1,000 requests | Insuficiente | Solo hay pruebas documentadas de baja concurrencia |
| Pool y conexiones a Postgres | Preparado, por verificar | Existen parámetros, pero debe comprobarse la configuración real |
| Aislamiento multi-cliente | Bueno, por verificar despliegue | Filtro en aplicación + RLS opcional como segunda barrera |
| Autenticación y autorización | Buena base | Revalidación por request y permisos fail-closed |
| Gestión de sesiones | Pendiente prioritario | Falta revocación completa y refresh token de un solo uso |
| Archivos y documentos | Pendiente | Uso de memoria, validación de contenido y streaming |
| Observabilidad | Buena base | Métricas, logs con request-id y health checks |
| Endurecimiento de producción | Incompleto | Faltan verificaciones de infraestructura y varios controles |

## 2. Cómo interpretar el objetivo

No son equivalentes:

1. **1,000 usuarios conectados:** tienen sesión abierta, pero generan requests de forma intermitente.
2. **1,000 usuarios virtuales concurrentes:** herramientas como k6 mantienen 1,000 usuarios ejecutando iteraciones.
3. **1,000 requests en el mismo instante:** ráfaga máxima; todos compiten al mismo tiempo por CPU, event loop, pool Prisma, Postgres y servicios externos.
4. **1,000 requests por segundo:** throughput sostenido; puede ser más exigente que 1,000 usuarios conectados, dependiendo de la latencia.

El objetivo debe escribirse como un SLO medible, por ejemplo:

- [ ] Definir si el objetivo significa usuarios conectados, VUs, requests simultáneos o RPS.
- [ ] Definir mezcla real de endpoints: login, dashboards, consultas, checadas, uploads y exports.
- [ ] Definir duración de la prueba y volumen de datos por cliente.
- [ ] Definir p95/p99 aceptable, porcentaje de errores y porcentaje máximo de `429` para tráfico legítimo.
- [ ] Definir cuántas réplicas y recursos de CPU/RAM tendrá el despliegue objetivo.

## 3. Lo que ya está bien en arquitectura

### API y procesos

- [x] Cada réplica ejecuta un proceso HTTP Node/Express stateless.
- [x] El API puede escalar horizontalmente detrás de un balanceador.
- [x] Los workers periódicos pueden ejecutarse en un proceso separado.
- [x] `RUN_WORKERS_IN_API=false` evita duplicar workers dentro de cada réplica del API.
- [x] Existe lock de líder para timers y reparto de jobs mediante pg-boss.
- [x] Las migraciones se ejecutan como paso de release, no en cada arranque del contenedor.
- [x] Existen `SIGTERM`/`SIGINT`, cierre del servidor y desconexión de Prisma.
- [x] Existen liveness y readiness; readiness comprueba Postgres.
- [ ] Confirmar que producción realmente ejecuta API y workers como procesos separados.
- [ ] Confirmar que el balanceador drena conexiones antes de terminar una réplica.

### Base de datos

- [x] Prisma admite `DATABASE_CONNECTION_LIMIT` y `DATABASE_POOL_TIMEOUT`.
- [x] Existe soporte para `DATABASE_PGBOUNCER=true`.
- [x] La regla documentada es: `réplicas × connection_limit ≤ 70%` del máximo disponible en Postgres.
- [x] Existen índices de alto volumen por tenant en checadas, accesos y correos.
- [x] La ingesta del agente usa `createMany` y deduplicación por `(clockSerial, serialNo)`.
- [ ] Confirmar el máximo real de conexiones del Postgres productivo.
- [ ] Confirmar si PgBouncer está instalado y si el API apunta a él.
- [ ] Calcular y documentar réplicas × pool del API + workers + migraciones + conexiones administrativas.
- [ ] Medir esperas por conexión y no solamente conexiones abiertas.
- [ ] Activar y revisar `pg_stat_statements` para localizar las consultas más costosas.
- [ ] Verificar índices con `EXPLAIN ANALYZE` usando datos representativos.

### Observabilidad

- [x] Métricas Prometheus de latencia, requests y errores.
- [x] Rutas normalizadas para evitar IDs en las etiquetas.
- [x] Request-id y contexto de tenant/usuario en logs.
- [x] Métricas de profundidad de cola y liderazgo de workers.
- [ ] Confirmar scrape real de todas las réplicas.
- [ ] Configurar alertas de 5xx, p95, readiness, colas y ausencia de líder.
- [ ] Agregar visibilidad de event-loop lag, pool Prisma y conexiones Postgres si el entorno no la proporciona.

## 4. Cuellos de botella identificados

### 4.1 Revalidación y RLS aumentan el trabajo por request

Cada request autenticado consulta la BD para revalidar usuario activo, tenant, roles y excepciones. Con RLS activo, las operaciones de modelos de cliente se envuelven en una transacción que fija `app.tenant_id`.

Esto es deseable para seguridad, pero implica más round-trips y mayor presión sobre el pool.

- [ ] Medir cuántas consultas y transacciones genera cada endpoint crítico.
- [ ] Medir autenticación por separado del trabajo de negocio.
- [ ] No reducir RLS ni validaciones de seguridad solo para mejorar el benchmark.
- [ ] Si se introduce caché de autenticación, definir invalidación y revocación inmediata antes de usarla.

Referencias: `api/src/core/middlewares/auth.middleware.ts`, `api/src/core/tenancy/extension.ts`.

### 4.2 Dashboards y asistencia

El reporte semanal calcula personas × siete días y reúne checadas, horarios, acuerdos, permisos y aprobaciones. `attendance-today` fuerza recálculo con `refresh: true`, por lo que no aprovecha la caché corta.

- [ ] Medir p95 con un cliente pequeño y otro de 5,000 empleados.
- [ ] Medir requests simultáneos a `attendance-today`, `people` y `overtime-week`.
- [ ] Evaluar pre-cálculo de asistencia por tenant/semana.
- [ ] Evaluar caché compartida; la caché actual es local a cada proceso.
- [ ] Evitar que dashboards ejecuten el mismo cálculo varias veces durante una sola carga de pantalla.

Referencias: `api/src/modules/schedules/services/weekly-attendance.service.ts`, `api/src/modules/dashboard/services/people-dashboard.service.ts`.

### 4.3 Exportación STPS

La exportación puede solicitar hasta 100,000 resultados de cálculo, además de marcajes activos, remotos, archivados y ajustes. El resultado se construye en memoria.

- [ ] Medir memoria y duración con el máximo periodo y volumen permitido.
- [ ] Mover exports grandes a un worker.
- [ ] Entregar un job `202 Accepted`, estado de progreso y descarga posterior.
- [ ] Evaluar streaming o escritura temporal a S3 para evitar strings/buffers completos en el API.

Referencia: `api/src/modules/nom/services/stps-export.service.ts`.

### 4.4 Uploads y descargas en memoria

Multer usa `memoryStorage`; las rutas tienen límites de archivo, pero múltiples uploads simultáneos pueden consumir varios GB de RAM. Las descargas de S3 también se convierten completas a `Buffer`.

- [ ] Probar uploads concurrentes con archivos del tamaño máximo permitido.
- [ ] Sustituir buffers por streaming o carga directa a S3 con URL firmada y validación posterior.
- [ ] Mantener límites por request y agregar límites de concurrencia/ancho de banda en el proxy.
- [ ] Revisar consistencia entre el límite Multer, `UPLOAD_MAX_BYTES` y el proxy.

Referencias: `api/src/modules/hr/routes/hr.routes.ts`, `api/src/modules/users/routes/user.routes.ts`, `api/src/core/services/storage.ts`.

### 4.5 Rate limiting

Defaults actuales:

- Login: 20 requests por IP cada 15 minutos.
- Rutas caras: 600 requests por IP cada 15 minutos.
- Rutas caras: 2,000 requests por tenant cada 15 minutos.
- Store: memoria local del proceso.

Consecuencias:

- Usuarios legítimos detrás de NAT pueden recibir `429`.
- Con N réplicas, los contadores no son globales.
- Una prueba de 1,000 logins desde una IP quedará limitada antes de medir la capacidad real.

- [ ] Sustituir el store por Redis u otro almacenamiento compartido.
- [ ] Definir límites combinados por IP, cuenta, tenant y dispositivo según el endpoint.
- [ ] Revisar límites para horarios de entrada/salida.
- [ ] Configurar correctamente `TRUST_PROXY` para no agrupar a todos detrás de la IP del balanceador ni confiar en headers falsificables.
- [ ] En pruebas, usar una configuración controlada sin desactivar protecciones en producción pública.

Referencias: `api/src/app.ts`, `api/src/core/middlewares/production.middleware.ts`, `api/src/core/config/env.config.ts`.

### 4.6 Integridad de checadas remotas bajo concurrencia

La ingesta del agente es idempotente. En checada remota, `clientEventId` es opcional y la validación de secuencia ocurre antes del insert, sin una transacción que serialice las operaciones por usuario. Dos requests simultáneos podrían leer el mismo estado anterior.

- [ ] Hacer obligatorio un identificador idempotente para apps/clientes que puedan reintentar.
- [ ] Probar dos requests idénticos sin `clientEventId`.
- [ ] Probar ENTRY/EXIT o LUNCH_START/LUNCH_END concurrentes.
- [ ] Serializar por usuario mediante transacción/lock o restricciones de BD que impidan estados inválidos.
- [ ] Mantener la respuesta idempotente cuando dos requests usan la misma clave.

Referencia: `api/src/modules/nom/services/remote-punch.service.ts`.

## 5. Controles de seguridad encontrados

### Autenticación, autorización y tenants

- [x] JWT firmado y refresh token diferenciado por `type`.
- [x] Un refresh token no sirve como access token.
- [x] El usuario se revalida contra la BD en cada request.
- [x] Se rechaza un token cuyo tenant no coincide con el usuario actual.
- [x] Un tenant suspendido corta el acceso aunque el token siga vigente.
- [x] Los roles y permisos frescos de la BD prevalecen sobre los claims del token.
- [x] Los permisos desconocidos cierran la ruta.
- [x] Existe aislamiento por tenant en la extensión Prisma.
- [x] RLS puede actuar como segunda barrera con `FORCE ROW LEVEL SECURITY`.
- [x] Los agentes usan tokens aleatorios, hash SHA-256 en BD y revocación/rotación.
- [x] Existe bitácora de accesos denegados con freno contra escritura excesiva.

### Aplicación e infraestructura

- [x] Helmet activo.
- [x] CORS configurable por lista y subdominios.
- [x] Body JSON limitado, 1 MB por defecto.
- [x] Validación de entrada con Zod y Prisma para acceso a datos.
- [x] Rate limit en login y rutas costosas.
- [x] Secretos de relojes cifrados con AES-256-GCM.
- [x] S3 privado, claves con prefijo de tenant y URLs firmadas.
- [x] Tokens Ably con capability limitada a suscripción de canales propios.
- [x] Endpoint de métricas protegido.
- [x] Contenedor API multi-stage y ejecución como usuario `node`, sin root.
- [x] `.env` y variantes ignorados por Git.

### Verificación obligatoria del despliegue

- [ ] `RLS_ENABLED=true` en producción.
- [ ] `DATABASE_URL` usa un rol sin `BYPASSRLS`.
- [ ] `WORKER_DATABASE_URL` está separado y limitado al proceso que lo necesita.
- [ ] `WEB_ORIGIN` no usa `*` en producción.
- [ ] `JWT_SECRET` es aleatorio, largo, exclusivo y almacenado en un gestor de secretos.
- [ ] `ENCRYPTION_KEY` es independiente de `JWT_SECRET`; no se depende de la derivación HKDF en producción.
- [ ] TLS se termina correctamente en el proxy/balanceador y HTTP público redirige o está bloqueado.
- [ ] El bucket S3 es realmente privado y tiene acceso IAM mínimo.
- [ ] La app key de Ably está rotada y no se expone al navegador.
- [ ] Los secretos no aparecen en logs, CI, imágenes Docker ni archivos commiteados.
- [ ] Backups cifrados, acceso restringido y restore ensayado.

## 6. Pendientes de seguridad priorizados

### Prioridad alta

#### A. Revocación de sesiones y refresh de un solo uso

Defaults actuales: access token de 7 días y refresh token de 30 días. Aunque el refresh responde con uno nuevo, no se persiste ni invalida el anterior. No se encontró revocación completa al cerrar sesión o cambiar contraseña. El campo `users.sessionVersion` existe, pero no se utiliza en el flujo de autenticación.

- [ ] Reducir la vida del access token, por ejemplo a 10–15 minutos.
- [ ] Persistir sesiones/refresh tokens o sus hashes con `jti`, usuario, tenant, expiración y estado.
- [ ] Invalidar el refresh anterior al rotarlo.
- [ ] Detectar reutilización y revocar toda la familia de sesión.
- [ ] Implementar logout con revocación de servidor.
- [ ] Incrementar/verificar `sessionVersion` al cambiar contraseña, restablecerla o revocar sesiones.
- [ ] Probar logout, cambio de contraseña, baja de usuario y reutilización de refresh.

Referencias: `api/src/core/utils/security.ts`, `api/src/modules/auth/services/auth.service.ts`, `api/prisma/schema.prisma`.

#### B. Almacenamiento de tokens en la web

La web guarda access y refresh tokens en `localStorage`. Un XSS podría leerlos.

- [ ] Mantener el access token solo en memoria cuando sea viable.
- [ ] Evaluar refresh en cookie `HttpOnly + Secure + SameSite`.
- [ ] Si se usan cookies, agregar protección CSRF y revisar CORS/credenciales.
- [ ] Reducir XSS con sanitización, CSP y revisión de dependencias.
- [ ] No migrar a cookies sin diseñar logout, rotación y CSRF como un solo flujo.

Referencia: `web/src/entities/user/model/auth.slice.ts`.

#### C. Contraseñas y MFA

El cambio de contraseña acepta seis caracteres y no se encontró MFA.

- [ ] Elevar el mínimo de contraseña y validar contraseñas comprometidas/comunes.
- [ ] Exigir MFA para ADMIN, SUPPORT y RH; evaluarlo para todos los usuarios.
- [ ] Agregar rate limit por cuenta + tenant + IP, no solo por IP.
- [ ] Aplicar límites y auditoría también a refresh y recuperación de cuenta.
- [ ] Mantener respuestas genéricas para no enumerar usuarios o tenants.

Referencia: `api/src/modules/auth/models/dto/auth.dto.ts`.

#### D. RLS efectiva en producción

El repositorio incluye RLS, pero `.env.example` muestra `RLS_ENABLED=false`. Sin activarla sigue existiendo el filtro de aplicación, pero se pierde la defensa adicional en Postgres.

- [ ] Activar RLS en staging y producción.
- [ ] Ejecutar pruebas de aislamiento con un rol real sin `BYPASSRLS`.
- [ ] Verificar que login y agentes solo usen el bypass controlado.
- [ ] Revisar que ningún endpoint de negocio use `runWithRlsBypass`.

Referencias: `api/.env.example`, `api/src/core/tenancy/extension.ts`, `docs/OPERACION_PRODUCCION.md`.

### Prioridad media

#### E. Exposición de errores internos

El handler de errores 500 devuelve `err.message` en `details`.

- [ ] Responder únicamente código y mensaje genérico.
- [ ] Mantener detalle y stack solo en logs protegidos.
- [ ] Revisar que errores de Prisma no expongan más metadata de la necesaria.

Referencia: `api/src/core/middlewares/error.middleware.ts`.

#### F. Tokens de fotos en URLs y logs

El token de foto viaja en `?token=` y Morgan registra `:url`, por lo que puede quedar en access logs durante su vigencia.

- [ ] Redactar query strings sensibles en logs del API y proxy.
- [ ] Evaluar cookie/header o proxy autenticado en lugar de token en query.
- [ ] Revisar historial del navegador, analítica y encabezado `Referer`.
- [ ] Mantener expiración corta mientras se cambia el mecanismo.

Referencias: `api/src/app.ts`, `api/src/modules/api.router.ts`, `api/src/core/utils/security.ts`.

#### G. Validación de archivos

El tipo permitido se decide principalmente por el MIME declarado por el cliente.

- [ ] Validar magic bytes/contenido real.
- [ ] Re-codificar imágenes cuando corresponda.
- [ ] Analizar documentos con antimalware antes de habilitar descarga.
- [ ] Servir descargas con `Content-Disposition` y `nosniff` apropiados.
- [ ] Mantener nombres sanitizados y claves no predecibles.

Referencia: `api/src/modules/hr/services/employee-document.service.ts`.

#### H. Superficie y cadena de suministro

Swagger está disponible sin autenticación y el CI revisado ejecuta calidad, pruebas e imágenes, pero no se observó escaneo de dependencias/SAST/contenedores.

- [ ] Restringir o desactivar Swagger en producción si no es necesario.
- [ ] Agregar auditoría de dependencias de producción.
- [ ] Agregar escaneo de secretos, SAST y vulnerabilidades de imágenes.
- [ ] Definir severidad que bloquea merge/release y proceso de excepciones.
- [ ] Mantener lockfile y actualizaciones periódicas.

Referencias: `api/src/core/swagger/setup.ts`, `.github/workflows/ci.yml`.

## 7. Plan de prueba para 1,000 VUs

### Condiciones

- [ ] Usar staging aislado, nunca producción ni una BD de cliente.
- [ ] Usar la misma versión de imagen, Node, Postgres y configuración de RLS/PgBouncer que producción.
- [ ] Sembrar un cliente grande, idealmente 5,000 empleados, y volumen histórico representativo.
- [ ] Probar primero una réplica para obtener baseline y después la topología objetivo.
- [ ] No ejecutar workers dentro del API durante la prueba salvo que esa sea la topología a medir.
- [ ] Monitorear API, Postgres, PgBouncer, workers, Redis si aplica, S3 y Ably.

### Escalones sugeridos

1. 100 VUs durante 10 minutos.
2. 500 VUs durante 10 minutos.
3. 1,000 VUs durante 10–15 minutos.
4. Ráfaga de 1,000 requests en el menor tiempo posible.
5. Prueba de soak de 1–2 horas para detectar fuga de memoria, crecimiento de cachés y degradación de BD.

### Escenarios

- [ ] Login real con bcrypt, usando una configuración de rate limit controlada.
- [ ] Dashboards: `attendance-today`, `people`, `overtime-week`.
- [ ] Consultas `/query` con paginación.
- [ ] Ingesta del agente en lotes de 25 y lotes máximos permitidos.
- [ ] Checadas remotas con idempotencia y requests duplicados.
- [ ] Uploads/descargas como escenario separado para no ocultar el resultado del resto.
- [ ] Export STPS grande como escenario separado.
- [ ] Mezcla representativa de todos los anteriores.

Los scripts existentes están en `api/load/k6/` y aceptan `VUS` y `DURATION`. Ejemplo orientativo, solo contra el entorno de carga preparado:

```bash
set -a
source load/.env.load
set +a

VUS=100 DURATION=10m k6 run load/k6/dashboards.js
VUS=500 DURATION=10m k6 run load/k6/dashboards.js
VUS=1000 DURATION=15m k6 run load/k6/dashboards.js
```

Repetir con `login.js` y `agent-punches.js`. Para una ráfaga exacta o una mezcla de endpoints será necesario agregar escenarios k6 específicos.

### Umbrales iniciales ya presentes

- Errores HTTP: `< 1%`.
- Login p95: `< 1,000 ms`.
- Dashboards p95: `< 800 ms`.
- Ingesta de agente p95: `< 800 ms`.

Agregar:

- [ ] `429 ≈ 0` para tráfico legítimo dentro de la capacidad contratada.
- [ ] Sin crecimiento sostenido de memoria durante el soak.
- [ ] Sin agotamiento del pool ni saturación de conexiones Postgres.
- [ ] Sin duplicados ni secuencias inválidas de checadas.
- [ ] CPU con headroom; no operar continuamente al 100%.
- [ ] Profundidad de colas estable o recuperándose después del pico.
- [ ] p99 y tamaño máximo de respuesta registrados, no solo p95.

## 8. Orden recomendado de implementación

### Antes de la prueba grande

- [ ] Confirmar RLS, roles de BD, CORS, proxy, TLS y secretos.
- [ ] Documentar réplicas, CPU/RAM y conexiones disponibles.
- [ ] Preparar staging y dataset representativo.
- [ ] Ajustar rate limiting de prueba sin exponer producción.
- [ ] Configurar dashboards de métricas y captura de resultados.

### Para sostener 1,000 requests

- [ ] PgBouncer y pools calculados.
- [ ] Rate limiting distribuido.
- [ ] N réplicas del API detrás del balanceador.
- [ ] Workers separados y escalados por profundidad de cola.
- [ ] Reportes/exports pesados como jobs.
- [ ] Pre-cálculo/caché compartida de asistencia donde la medición lo justifique.
- [ ] Streaming para archivos y timeouts/límites en el proxy.

### Para endurecer seguridad

- [ ] Revocación de sesiones y refresh tokens de un solo uso.
- [ ] Access tokens cortos.
- [ ] Refresh fuera de `localStorage` o riesgo explícitamente aceptado y compensado.
- [ ] MFA para roles privilegiados.
- [ ] Redacción de logs y errores genéricos.
- [ ] Validación real y análisis de archivos.
- [ ] Escaneo continuo de dependencias, código, secretos e imágenes.

## 9. Criterio final de aceptación

No marcar el objetivo como cumplido hasta poder responder sí a todos:

- [ ] La prueba de 1,000 VUs terminó dentro de los SLO definidos.
- [ ] La ráfaga de 1,000 requests también fue medida.
- [ ] La prueba usó datos y configuración representativos, incluida RLS.
- [ ] No hubo errores de integridad ni aislamiento entre tenants.
- [ ] Postgres y los pools conservaron capacidad de reserva.
- [ ] La memoria y las colas se recuperaron después del pico.
- [ ] La topología probada es la misma que se desplegará.
- [ ] Los pendientes de seguridad de prioridad alta están cerrados o tienen riesgo formalmente aceptado.
- [ ] Existe un reporte repetible con fecha, commit, configuración, resultados y umbrales.

## 10. Conclusión

La base arquitectónica permite trabajar hacia 1,000 requests simultáneos sin reescribir el sistema. El API ya tiene piezas importantes de producción, pero la capacidad objetivo sigue sin estar demostrada. El camino correcto es medir por escenarios, proteger Postgres, distribuir límites y caché, sacar trabajo pesado del request HTTP y cerrar los pendientes de sesiones y datos sensibles.

La afirmación recomendada hasta completar la validación es:

> “La plataforma está diseñada para escalar horizontalmente; la capacidad de 1,000 requests simultáneos está pendiente de certificación mediante pruebas en una topología y volumen representativos.”

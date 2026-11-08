# Matriz maestra de bots QA — CheckLab

Fecha de creación: **2026-11-08**.

Esta matriz dirige la ejecución de bots sobre **API, WEB y APP**. La matriz atómica de pantallas, tabs, modales y acciones web vive en [`QA_MATRIX.md`](QA_MATRIX.md); sus IDs se conservan y no se duplican aquí.

## 1. Reglas de ejecución

- Sólo entornos locales: API en loopback y bases `tm_test*`, `tm_qa*` o `tm_e2e`.
- Nunca ejecutar contra Railway, producción, `tm_demo` ni una base cuyo nombre no pase las guardas del arnés.
- Correo, Ably y dispositivos externos se sustituyen por mocks en la ejecución automática. Reloj físico, estación de huellas, cámara RTSP, S3/correo reales, FCM/APNs y dispositivos físicos quedan como validación manual separada.
- Cada corrida usa datos propios. Los bots de API crean un cliente `qa-<sello>`; los E2E web siembran `tm_e2e`.
- Una pantalla no pasa por abrir: debe ejecutar su flujo principal, validar errores y comprobar el efecto.
- Una mutación no pasa por recibir HTTP 2xx: debe releerse el estado o comprobarse el efecto visible/persistido.
- Toda acción P0 se prueba con actor permitido, actor denegado y, cuando aplique, actor de otro cliente.
- La cobertura estática de un ID no equivale a una prueba exitosa. El resultado sólo cambia tras ejecutar y conservar evidencia.

## 2. Estados y prioridades

| Valor | Significado |
|---|---|
| `PENDIENTE` | Aún no ejecutado en esta campaña |
| `EJECUTANDO` | Bot o suite en ejecución |
| `PASÓ` | Resultado y efecto esperados confirmados |
| `FALLÓ` | Hay desviación del producto o una regresión |
| `BLOQUEADO` | No se pudo ejecutar por entorno, arnés o dependencia |
| `MANUAL` | Requiere hardware, servicio externo o dispositivo físico |
| `NO APLICA` | Fuera de alcance por decisión de producto |

Prioridades: `P0` seguridad/operación crítica, `P1` flujo principal, `P2` bordes y experiencia secundaria.

## 3. Actores y modos obligatorios

| Actor | Uso en los bots | Debe probarse |
|---|---|---|
| Anónimo | Sin token/sesión | 401, rutas públicas, ausencia de fugas |
| `ADMIN` | Plataforma | Clientes, planes, agentes, impersonación, roles globales |
| `SUPPORT` | Plataforma | Alcance de soporte y acciones prohibidas |
| `CLIENT_ADMIN` | Cliente QA | Operación completa del tenant y límites de plataforma |
| `HUMAN_RESOURCES` | Cliente QA | RH, asistencia, horarios y nómina; restricciones de aprobación/configuración |
| `CLIENT_STAFF` | Personal QA | Sólo datos propios, checada, teletrabajo, permisos y perfil |
| Rol secundario | Staff + admin | Unión de permisos efectivos |
| Intruso admin/staff | Segundo cliente | Aislamiento por ID, token, consulta, export y mutación |

Modos transversales: permitido/denegado, activo/inactivo, vacío/con datos, válido/inválido, duplicado/conflicto, inexistente, propio/ajeno, en línea/sin red, reintento/idempotencia, fechas y zona horaria del cliente, paginación/filtros, cancelar/confirmar y persistencia tras recargar o reiniciar sesión.

## 4. Matriz API

Todas las filas API incluyen, cuando el endpoint lo permite: contrato de entrada, éxito, validación 400, no autenticado 401, prohibido 403, inexistente 404, conflicto 409, alcance de tenant y auditoría de mutaciones.

| ID | Módulo / flujo | Casos mínimos | Bot o suite | P | Estado |
|---|---|---|---|---|---|
| API-00 | Salud y readiness | `/health`, `/health/ready`, BD disponible/caída, formato y códigos | `infra.flow.test.ts` | P0 | PENDIENTE |
| API-01 | Auth y sesión | Login por slug, credenciales inválidas, cliente inexistente/suspendido, usuario inactivo, `me`, refresh, logout, cambio forzado, rate limit | `auth.flow.test.ts`, `rate-limit.flow.test.ts`, bot `sesiones` | P0 | PENDIENTE |
| API-02 | Tenants e impersonación | CRUD/alta guiada, slug reservado, suspensión/reactivación, selección por header, entrar/salir, módulos, timezone | `tenancy.flow.test.ts`, `tenants-impersonation.flow.test.ts`, `tenant-timezone.flow.test.ts` | P0 | PENDIENTE |
| API-03 | Planes, límites y cobros | CRUD planes, duplicados, baja/reactivación, límites de personas/relojes, cargos/pagos | `plans.flow.test.ts`, `tenant-payments.flow.test.ts` | P1 | PENDIENTE |
| API-04 | Usuarios y personal | Alta/edición/lista, disponibilidad, duplicados, roles extra, baja/reactivación/eliminación, cuenta e historial | `personal.flow.test.ts`, bot `personal-roles` | P0 | PENDIENTE |
| API-05 | Importación y fotos | Plantilla, XLSX válido/inválido, filas omitidas, foto firmada, token ausente/ajeno/expirado | `users-import.flow.test.ts`, `photo.flow.test.ts` | P1 | PENDIENTE |
| API-06 | Expedientes RH | Perfil/overview, documentos, obligatorios/faltantes, avisos, descuentos y alcance propio/ajeno | `hr-overview.flow.test.ts`, `hr-catalogs-records.flow.test.ts` | P0 | PENDIENTE |
| API-07 | Actas y catálogos | CRUD actas/tipos de documento, validaciones, baja lógica/definitiva, permisos de catálogo | `hr-catalogs-records.flow.test.ts` | P1 | PENDIENTE |
| API-08 | Departamentos y subáreas | CRUD, baja/reactivación, relaciones, duplicados, permisos y aislamiento | bots/integración de organización | P1 | PENDIENTE |
| API-09 | RBAC/ABAC | Roles, matriz, alcances, excepciones, políticas, simulador, miembros, catálogo y actividad | `permissions-matrix.flow.test.ts`, `platform-guard.flow.test.ts`, bot `permisos` | P0 | PENDIENTE |
| API-10 | Dashboard y reportes | KPIs por rol, datos vacíos, asistencia hoy, expedientes, HE y huecos de configuración | integración dashboard + E2E de contrato | P1 | PENDIENTE |
| API-11 | Notificaciones y realtime | Lista/filtros/paginación, leída/todas, borrar, contador, token Ably, aislamiento | `ably.flow.test.ts`, `cursor.flow.test.ts`, `cursor-more.flow.test.ts` | P1 | PENDIENTE |
| API-12 | Auditoría | Creación por mutaciones, filtros, detalle, anterior/nuevo, paginación, inmutabilidad y aislamiento | `audit-filters.flow.test.ts`, `cursor-more.flow.test.ts` | P0 | PENDIENTE |
| API-13 | Configuración | Lectura/escritura por tabs, validación de límites, defaults, checada web y persistencia | `nom.flow.test.ts`, `platform-config.flow.test.ts` | P1 | PENDIENTE |
| API-14 | Checadas NOM | ENTRY/LUNCH_OUT/LUNCH_IN/EXIT, secuencia, WEB/CLOCK/HYBRID, GPS, `clientEventId`, duplicados, discrepancias | `nom.flow.test.ts`, `checkin-mode.flow.test.ts`, bot `jornada` | P0 | PENDIENTE |
| API-15 | Registro y conformidad | Métodos de registro, evidencia, ajustes, acuses, conformidad semanal, export STPS y retención | `work-record.flow.test.ts`, `workday-evidence.flow.test.ts`, `record-agreement.flow.test.ts`, `retention-adjustment.flow.test.ts` | P0 | PENDIENTE |
| API-16 | Teletrabajo | Política/versionado, consentimiento, registros, checklists, comunicaciones, diferimientos y aislamiento | `telework-compliance.flow.test.ts`, bot `nom-cumplimiento` | P1 | PENDIENTE |
| API-17 | Vacaciones y permisos | Saldos, solicitud/cancelación, solapes, aprobar/rechazar, goce, antigüedad y días de borde | `leave.flow.test.ts` | P0 | PENDIENTE |
| API-18 | Convenios de jornada | Distribución art. 58, evidencia, vigencia, firmas y transición legal | `distribution.flow.test.ts`, `record-agreement.flow.test.ts` | P1 | PENDIENTE |
| API-19 | Horarios | CRUD 7 días, descanso, nocturno, legalidad, activar/desactivar, asignación/reemplazo/vigencias, retardos | `schedule-legality.flow.test.ts`, `schedule-assignments.flow.test.ts`, `schedules-late.flow.test.ts`, bot `horarios` | P0 | PENDIENTE |
| API-20 | Tiempo extra | Motor doble/triple/excedente, topes, aprobación/rechazo, confirmación semanal y snapshot | `overtime-request.flow.test.ts`, bot `horas-extra` | P0 | PENDIENTE |
| API-21 | Nómina | Puestos/settings/asignación, cálculo, asistencia semanal, revisión, cierre, snapshot y reapertura | `payroll.flow.test.ts`, `payroll-positions.flow.test.ts` | P0 | PENDIENTE |
| API-22 | Relojes y asistencia | CRUD reloj, credenciales write-only, conexión/sync/import, cursores, WEB/CLOCK/HYBRID, roster, vínculos, export | `clock-*.flow.test.ts`, `clock-summary-roster.flow.test.ts`, `clock-api-key.flow.test.ts`, `clock-credentials.flow.test.ts` | P0 | PENDIENTE |
| API-23 | Agente local | Tokens, versión/estado, ingesta, jobs por acción, validación, reintentos, revocación y aislamiento | `agent.flow.test.ts` | P0 | PENDIENTE |
| API-24 | Correo y cola | Plantillas, dry-run, encolado, logs, reintento/cancelación; nunca envío directo desde request | unit email + integración/mock | P1 | PENDIENTE |
| API-25 | Seguridad transversal | CORS, Helmet, body inválido, inyección/payloads extremos, rate limit, tokens y RLS/tenant scope | `infra.flow.test.ts`, `tenancy-check`, unit security/RLS | P0 | PENDIENTE |

## 5. Matriz WEB

La ejecución web debe recorrer los **49 IDs de pantalla, 39 de tab, 71 de modal y 37 de acción** de `QA_MATRIX.md`. Esta tabla agrupa suites sin sustituir esos casos atómicos.

| ID | Flujo | Cobertura mínima | Suite/bot | P | Estado |
|---|---|---|---|---|---|
| WEB-00 | Build y arranque | TypeScript, lint, rutas públicas/privadas, health y consola sin errores inesperados | build + Playwright | P0 | PENDIENTE |
| WEB-01 | Auth y shell | Login cliente/plataforma, errores, force-password, logout, refresh, slug/subdominio y guard de sesión | `auth`, `client-routes` | P0 | PENDIENTE |
| WEB-02 | Landing | FAQ, CTA, tema persistido, menú móvil, reduced motion y ausencia de overflow | `landing`, `landing.mobile` | P2 | PENDIENTE |
| WEB-03 | Inicio y plataforma | Consola, KPIs, inicio por rol, clientes, detalle/tabs, módulos, cobros, planes e impersonación | `home`, `tenants`, `platform-*`, `platform-plans` | P0 | PENDIENTE |
| WEB-04 | Roles y permisos | CRUD, matriz, revisar/aplicar, excepciones, ABAC, catálogo, simulador, bitácora y guards | `roles`, `platform-roles` | P0 | PENDIENTE |
| WEB-05 | Mi jornada | Secuencia de checadas, modos, marcajes, discrepancias, teletrabajo, registro/conformidad, HE y vacaciones | `mi-jornada`, `mi-jornada.mobile`, `nom-portal`, `nom-telework`, `workday-agreements`, `leave` | P0 | PENDIENTE |
| WEB-06 | Personal y cuentas | Lista/filtros, alta/edición, importación, baja/reactivar/eliminar, historial, roles extra y permisos | `personal`, `personal.mobile`, `employee-detail` | P0 | PENDIENTE |
| WEB-07 | Expedientes y actas | Tabs, documentos, foto, credencial/QR, avisos, actas/PDF y catálogos | `employee-records`, `document-catalog`, `disciplinary-reports` | P1 | PENDIENTE |
| WEB-08 | Organización | Departamentos, detalle, subáreas, baja lógica/definitiva y permisos | `departments`, `subareas` | P1 | PENDIENTE |
| WEB-09 | Horarios | Lista/filtros, alta/edición 7 días, legalidad, activar/desactivar, asignar/reemplazar/quitar | `schedules` | P0 | PENDIENTE |
| WEB-10 | Tiempo extra | Filtros, doble/triple/excedente, aprobar/rechazar, export y confirmación semanal | `overtime-payroll` | P0 | PENDIENTE |
| WEB-11 | Nómina | Semana, resumen/detalle, revisar/cerrar/reabrir, historial, puestos, asignación, settings y cálculo | `payroll-*`, `overtime-payroll` | P0 | PENDIENTE |
| WEB-12 | Checadas y asistencia | Resumen, sync/import/reintento, entradas/salidas, periodos, inactivos y exportaciones | `access-time-clock`, `clock-roster` | P0 | PENDIENTE |
| WEB-13 | Relojes y personas | CRUD/conexión, dashboard/tabs, roster, vínculos/diferencias, personas, tarjetas, inspect, cámara/lector mock | `time-clocks`, `clock-*` | P0 | PENDIENTE |
| WEB-14 | Agente | Token visible una vez, crear/rotar/revocar, jobs, validaciones y estados | `agent-console` | P1 | PENDIENTE |
| WEB-15 | Notificaciones | Filtros, contador, leer/todas, borrar, navegación y realtime mock | `notifications` | P1 | PENDIENTE |
| WEB-16 | Configuración y auditoría | Tabs/settings, retención, catálogos, filtros/detalle de auditoría y aislamiento | `client-settings`, `platform-settings`, `platform-audit` | P1 | PENDIENTE |
| WEB-17 | Roles en UI | ADMIN/SUPPORT/CLIENT_ADMIN/HR/STAFF/rol secundario; botones, rutas y datos permitidos/prohibidos | suites por rol + API real | P0 | PENDIENTE |
| WEB-18 | Responsividad y accesibilidad | Desktop, Pixel 7, navegación por teclado, foco/modales, nombres accesibles, contraste y zoom/reflow | Playwright móvil + axe/smoke | P1 | PENDIENTE |
| WEB-19 | Idioma y errores | es/en donde exista, fechas/zona, vacío/carga/error, doble submit, red caída y recuperación | Playwright con interceptores controlados | P1 | PENDIENTE |
| WEB-20 | Electron | Arranque, sesión, navegación, actualización de URL/API y cierre sin procesos huérfanos | smoke manual/automatizado desktop | P2 | MANUAL |

## 6. Matriz APP Android/iOS

La APP cubre el producto del cliente; clientes/planes/pagos/agentes/impersonación de plataforma son `NO APLICA`. Cada sección se prueba en Android y, cuando el entorno lo permita, iOS; los unit/common no sustituyen el E2E de UI.

| ID | Sección / flujo | Casos mínimos | Bot o suite | P | Estado |
|---|---|---|---|---|---|
| APP-00 | Build común | Compilación Android/iOS, unit common, contratos y recursos de marca | Gradle/Xcode | P0 | PENDIENTE |
| APP-01 | Splash, login y sesión | Código empresa, login OK/error, cliente inexistente/inactivo, force-password, restaurar sesión, refresh, logout y back | E2E + `SessionRepositoryTest` | P0 | PENDIENTE |
| APP-02 | Navegación y permisos | Drawer/bottom tabs por rol, ruta directa denegada, volver/inicio, rol secundario y sesión expirada | E2E + `MenuTest` | P0 | PENDIENTE |
| APP-03 | Inicio | Checada rápida, KPIs por permiso, vacío/error, refrescar y navegación a Mi jornada | E2E + home tests | P1 | PENDIENTE |
| APP-04 | Mi checada | Secuencia completa, hora servidor, modos, nota, GPS, doble tap, estado tras recarga | E2E + `NomApiTest` | P0 | PENDIENTE |
| APP-05 | Offline e idempotencia | Sin red, cola cifrada, `clientEventId`, reinicio app, reintento/backoff, reconciliación y 409 sin duplicar | `PunchQueueTest` + E2E red | P0 | PENDIENTE |
| APP-06 | GPS y privacidad | Permitido/denegado/sin precisión/sin hardware, captura sólo al checar, ausencia de rastreo en background | E2E dispositivo/simulador | P0 | PENDIENTE |
| APP-07 | Marcajes y discrepancias | Rangos/orígenes, vacío/error, motivo corto/válido, persistencia y aislamiento propio | E2E + `NomApiTest` | P1 | PENDIENTE |
| APP-08 | Teletrabajo del personal | Política, aviso, consentimiento, checklist inicial/periódico, incompleto y re-aceptación | E2E worker portal | P1 | PENDIENTE |
| APP-09 | Registro, HE y vacaciones | Método, conformidad, fuera de jornada, solicitudes HE, saldo, crear/cancelar permiso y errores | E2E worker portal | P0 | PENDIENTE |
| APP-10 | Notificaciones | Contador, filtros, leer/todas, borrar, navegación, vacío y recuperación de red | E2E + `NotificationsTest` | P1 | PENDIENTE |
| APP-11 | Mi perfil | Datos/foto, cambio contraseña, credencial QR v2, logout y limpieza de datos sensibles | E2E + `CredentialQrTest` | P1 | PENDIENTE |
| APP-12 | Personal | Lista/búsqueda/filtros, alta/edición, ficha, baja/reactivación, validaciones y permisos | E2E + contratos `PeopleApi` | P0 | PENDIENTE |
| APP-13 | Expedientes y actas | Actividad/documentos/datos, faltantes, lista/alta/detalle/eliminación de actas; subida documentos pendiente se reporta aparte | E2E + contratos | P1 | PENDIENTE |
| APP-14 | Departamentos | Lista/detalle, alta/edición/baja, subáreas si están expuestas, validaciones y permisos | E2E people | P1 | PENDIENTE |
| APP-15 | Aprobaciones | HE aprobar/rechazar/motivo/filtros; permisos aprobar/rechazar; RH vs admin; efecto visible al personal | E2E approvals | P0 | PENDIENTE |
| APP-16 | Horarios y asignación | Lista, editor 7 días, legalidad, activar/desactivar, asignar/reemplazar/quitar y persistencia | E2E schedules + contratos | P0 | PENDIENTE |
| APP-17 | Pre-nómina y puestos | Semana/departamento, revisar/cerrar/reabrir, historial, CRUD/asignación de puestos y validaciones | E2E payroll + `WriteBodiesTest` | P0 | PENDIENTE |
| APP-18 | Relojes y asistencia | Conexión/estado/alertas/sync, checadas hoy, roster, rejilla semanal, errores offline y permisos | E2E + `ClocksTest` | P0 | PENDIENTE |
| APP-19 | Configuración y convenios | `/nom/config`, tabs, persistencia, consulta/alta de convenios y validación de evidencia | E2E + `SettingsTest`, `AgreementValidationTest` | P1 | PENDIENTE |
| APP-20 | Teletrabajo administrativo | Política, registros, checklists, comunicaciones, permisos de lectura/escritura | E2E settings | P1 | PENDIENTE |
| APP-21 | Roles y auditoría | Consulta de roles, acceso denegado, bitácora/filtros/detalle inmutable; edición de permisos permanece en web | E2E settings | P1 | PENDIENTE |
| APP-22 | Plataforma | No exponer login ni consola de plataforma en APP | guard E2E | P0 | PENDIENTE |
| APP-23 | Android | APK debug, **dispositivo físico conectado**, emulador API 24 si está disponible, permisos, rotación, proceso reiniciado, back, teclado y tamaños de texto | Gradle + bot UI Android físico | P1 | PENDIENTE |
| APP-24 | iOS | Build/tests simulador, permisos, rotación, reinicio, back/gestos, teclado y Dynamic Type | Xcode + bot UI iOS | P1 | PENDIENTE |
| APP-25 | Tablet, landscape y accesibilidad | Reflow, drawer/tablas densas, contraste, TalkBack/VoiceOver, targets táctiles y textos grandes | E2E/manual visual | P1 | PENDIENTE |
| APP-26 | Push y mapas nativos | FCM/APNs y mapa nativo están pendientes de producto; verificar fallback actual sin anunciar capacidad inexistente | manual cuando se implemente | P2 | MANUAL |

## 7. Matriz de extremo a extremo entre superficies

| ID | Recorrido | Confirmación cruzada | P | Estado |
|---|---|---|---|---|
| E2E-01 | Admin web crea cliente/personal → app inicia sesión | Misma cuenta/rol/branding y datos del tenant | P0 | PENDIENTE |
| E2E-02 | Personal checa en APP → RH consulta en WEB/API | Un solo marcaje, hora/zona/GPS/origen correctos | P0 | PENDIENTE |
| E2E-03 | Checada offline APP → reintento → WEB | `clientEventId` evita duplicados tras reintentos | P0 | PENDIENTE |
| E2E-04 | Personal solicita permiso APP → RH decide WEB/APP | Estado, saldo, notificación y auditoría coherentes | P0 | PENDIENTE |
| E2E-05 | RH asigna horario WEB → APP/API calculan asistencia | Una vigencia, reemplazo y mismos resultados | P0 | PENDIENTE |
| E2E-06 | HE generada por marcajes → aprobación APP/WEB → nómina | Dobles/triples y snapshot iguales en todos los clientes | P0 | PENDIENTE |
| E2E-07 | RH cierra semana APP → historial WEB/API | Revisiones, quién/cuándo, snapshot y reapertura | P0 | PENDIENTE |
| E2E-08 | Cambio de permiso WEB → token/sesión APP | Menú, ruta y API deniegan/permiten coherentemente | P0 | PENDIENTE |
| E2E-09 | Baja de personal WEB → login/checada APP/API | Sesión bloqueada y efecto en reloj según configuración | P0 | PENDIENTE |
| E2E-10 | Cliente A e intruso B en WEB/APP/API | Ninguna lectura, export, archivo o mutación cruza tenants | P0 | PENDIENTE |

## 8. Orden y evidencia

1. **Estática:** typecheck/build/lint/unit de API, WEB y APP; medir cobertura de IDs.
2. **API:** PostgreSQL aislado, integración y bots con reparto nuevo; luego `tenancy-check` local.
3. **WEB:** stack E2E serial, Chromium + mobile; guardar reporte, trazas y capturas de fallos.
4. **APP:** unit/common, Android, iOS y bots UI; separar fallo de producto de limitación del entorno.
5. **Cruce:** recorridos E2E-01..E2E-10 con el mismo dataset cuando sea posible.
6. **Manual:** hardware, servicios externos, Electron, físicos, push/mapas y accesibilidad asistida.

Artefactos por corrida:

- `api/qa/out/report.json` y `report.md` para bots API.
- Reporte JUnit/HTML/JSON y trazas/capturas de Playwright para WEB.
- Reportes Gradle/Xcode y capturas/logs de dispositivo para APP.
- `docs/QA_MEJORAS.md`: cada hallazgo con ID, severidad, superficie, pasos, esperado/actual, evidencia, propuesta y estado.
- Esta matriz: estado por fila y fecha de la última ejecución; nunca marcar `PASÓ` por cobertura estática.

## 9. Criterio de cierre de la campaña

La campaña sólo está completa cuando todas las filas automáticas tienen resultado ejecutado, no hay fallos P0/P1 abiertos sin una decisión explícita, los casos `MANUAL` tienen evidencia o responsable pendiente, y cada hallazgo está enlazado a una mejora reproducible. Los pendientes conocidos de producto se reportan como brechas de alcance, no se disfrazan como pruebas exitosas.

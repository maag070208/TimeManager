# Matriz QA integral — CheckLab

Fecha de inventario: **2026-11-06**. Fuente: rutas de `web/src/app/App.tsx`, páginas, features/widgets y diálogos reales; pruebas existentes en `web/tests/e2e`, `web/src/**/*.test.*` y `api/{src,tests}/**/*.test.ts`.

Esta matriz es la **fuente única para generar pruebas**. Cada fila debe terminar con, al menos, una prueba E2E de su flujo principal y una prueba unitaria/integración de su regla de negocio. Los IDs son estables y se usan para nombrar specs, fixtures y casos.

## Resumen

| Nivel | Cantidad inventariada |
|---|---:|
| Pantallas/rutas | **49** |
| Subpantallas/tabs | **39** |
| Modales/diálogos reales | **71** |
| Suites E2E existentes | **21 archivos / 75 casos** |
| Specs unitarias e integración existentes | **55 archivos API + 1 web** |

**Prioridades:** `P0` = bloquea operación o seguridad (se automatiza primero). `P1` = flujo principal del módulo. `P2` = borde, ayuda o lectura secundaria.

**Orden de la matriz:** recorrido de producto → acceso, inicio, portal del trabajador, RH/Personal, horarios/HE/nómina, relojes/NOM, configuración, plataforma. Las tablas de pantallas, tabs y modales conservan ese orden.

## Estrategia de prueba

| Nivel | Qué cubre | Dónde vive |
|---|---|---|
| Unit | Reglas puras: validaciones, cálculos LFT/NOM, normalización de payloads, builders de PDF, guards de ruta, filtros | `web/src/**/*.test.*`, `api/src/**/*.test.ts` |
| Integración | Endpoint + BD + tenant + permisos + auditoría; sin navegador | `api/tests/integration/*.flow.test.ts` |
| E2E | Flujo real con API, BD y mock del reloj; roles admin/RH/cliente/platform | `web/tests/e2e/*.spec.ts` |
| Manual | Hardware real (reloj/estación de huellas), correo real, cámara RTSP | Checklist manual |

**Regla de cobertura:** una pantalla no se considera cubierta si sólo se abre. Debe probar su acción principal, su confirmación/validación y su estado vacío/error. Un modal no se considera cubierto si sólo se abre: debe probar guardar, cancelar y validación.

## 1. Matriz de pantallas

### 1.1 Acceso e inicio

| ID | Módulo | Pantalla | Ruta | Permiso | Modales | Acciones clave | Datos/endpoints | E2E propuesto | Unit/Integración | P |
|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-01 | Auth | Login | `/login` | Público | AUTH-M1 (post-login) | Elegir cliente por slug/subdominio, usuario+contraseña, submit, volver a landing, acceso plataforma | `POST /auth/login`, `GET /auth/branding?tenant=`, `GET /auth/me`; sesión/refresh | Login cliente válido; cliente inexistente; cuenta dada de baja; submit deshabilitado sin credenciales | Unit: modelo de login/errores; Integración: `auth.flow.test.ts` | P0 |
| AUTH-02 | Auth | Landing pública | `/landing` | Público | — | Anclas, FAQ, toggle de tema, CTA demo (`mailto`), iniciar sesión, menú móvil | Contenido estático | FAQ abre/cierra; tema persiste; CTA; menú móvil sin overflow | Unit: persistencia de tema (si aplica) | P2 |
| PLAT-01 | Plataforma | Consola de plataforma | `/` | Sesión; datos `tenants.view`/`plans.view` | PLAT-M1..M4, M3 | KPIs clientes/MRR, búsqueda, entrar como cliente, asignar plan, suspender/reactivar, relojes, agente | `GET /tenants`, `GET /plans`, `POST /tenants`, `PATCH /tenants/:id`, `POST /tenants/:id/impersonate`, `/agent/agents` | KPIs y cobros; impersonar; acciones de fila; auditoría de impersonación | Integración: `tenancy.flow`, `platform-guard.flow`, `tenants-impersonation.flow` | P1 |
| PLAT-02 | Plataforma | Inicio del cliente | `/home` | Sesión; widgets por permisos | — | Primeros pasos, tableros de personal, expedientes, asistencia, HE, huecos de configuración | `GET /dashboard/people`, `/attendance-today`, `/hr-records`, `/overtime-week`, `/setup-gaps`, `/schedules` | Inicio por rol; widgets filtrados; vacío por widget | Integración de tableros por alcance | P1 |
| PLAT-03 | Plataforma | Clientes | `/tenants` | `tenants.view`; escrituras `tenants.manage` | PLAT-M1..M4 | KPIs, búsqueda, asignar plan, suspender/reactivar, relojes, agente, entrar, fila→detalle | `GET /tenants`, `/plans`, `POST/PATCH /tenants/:id`, `POST /tenants/:id/impersonate`, `/agent/agents` | Asignar plan y agente desde fila; suspender/reactivar; abrir detalle | Integración: `plans.flow`, `tenant-payments.flow`, `tenants-impersonation.flow` | P0 |
| PLAT-04 | Plataforma | Detalle de cliente | `/tenants/:id` | `tenants.view`/`tenants.manage` | PLAT-M2, M5 | Tabs Resumen/Módulos/Cobros/Actividad; checklist; toggles de módulos; registrar cargo; marcar pagado; abrir URL | `GET /tenants/:id`, `GET/POST/PATCH /tenants/:id/payments`, `PATCH /tenants/:id` | Toggle de módulo persiste; registrar cargo; marcar pagado; kardex | Integración: `tenant-payments.flow` | P1 |
| PLAT-05 | Plataforma | Planes | `/plans` | `plans.view`/`plans.manage` | PLAT-M6, M7 | KPIs, alta, edición, baja/reactivación, límites y precio | `GET/POST/PATCH/DELETE /plans/:id` | Alta/edición; baja deja de listarse; reactivar; clave duplicada | Unit: `plans/fixtures.test.ts`; Integración: `plans.flow` | P1 |
| PLAT-06 | Plataforma | Roles y permisos | `/roles` | `roles.manage` | PLAT-M8..M20 | Tabs Roles/Matriz/Acceso/Políticas/Catálogo/Actividad; matriz por celda; CRUD roles y permisos; miembros y excepciones; simulador; bitácora | `GET/POST/PATCH/DELETE /permissions/roles`, `/catalog`, `/policies`, `/matrix`, `/simulate`, `/activity/query`, `/members` | Matriz cambiar→revisar→aplicar; crear rol; permiso con alcances; excepción; simulador | Integración: `platform-guard.flow` + nueva de matriz/políticas; Unit: `role-key`/validaciones | P0 |
| PLAT-07 | Plataforma | Notificaciones | `/notifications` | Sesión | — | Filtros, marcar leída, marcar todas, borrar, salto por tipo, Ably | `GET /notifications`, `/unread-count`, `POST /:id/read`, `/read-all`, `DELETE /:id`, `/ably-token` | Filtros/conteos; borrar; persistencia; vacío; navegación por tipo | Unit: filtros/agrupado; Integración: `ably.flow` | P2 |
| AUD-01 | Auditoría | Bitácora | `/audit` | `audit.view` | AUD-M1 | Filtros cliente/persona/módulo/acción/búsqueda/fechas; tabla; detalle; limpiar | `GET /audit`, `GET /audit/:id`, filtros de tenants/usuarios | Detalle con roles/permisos/estado anterior-nuevo; cliente sólo su tenant; 403 | Integración: `cursor-more.flow` + nueva filtros/aislamiento | P1 |

### 1.2 Portal del trabajador

| ID | Módulo | Pantalla | Ruta | Permiso | Modales | Acciones clave | Datos/endpoints | E2E propuesto | Unit/Integración | P |
|---|---|---|---|---|---|---|---|---|---|---|
| NOM-01 | NOM | Mi jornada | `/mi-jornada` | `TenantOnly` | — | Checada web ENTRY→LUNCH→EXIT; modo REMOTO/HÍBRIDO/PRESENCIAL/CAMPO; mis marcajes; reportar discrepancia; teletrabajo; conformidad semanal; vacaciones | `/nom/me/punches`, `/punch`, `/discrepancies`, `/telework`, `/overtime-requests`, `/record-agreement`, `/leave/*` | Secuencia de 4 checadas; canales del cliente (WEB/APP/CLOCK); checklist incompleto; aceptar/rechazar conformidad; vacaciones | Integración: `nom.flow`; Unit: remote-punch/checkinMode/idempotencia | P0 |
| NOM-02 | NOM | Administración de teletrabajo | `/teletrabajo` | `time_clock.view`/`write` | NOM-M01..M03 | KPIs; tabs Política/Teletrabajadores/Checklists/Comunicaciones; editar política; alta/baja; registrar comunicación | `/nom/telework/policy`, `/registrations`, `/checklists`, `/out-of-hours-contacts`, `/users/employees` | Guardar política sube versión; alta/baja; motivo ≥5; read-only sin permiso | Unit: versión de política/checklist; Integración: registro/consentimiento | P1 |

### 1.3 Personal, expediente y organización

| ID | Módulo | Pantalla | Ruta | Permiso | Modales | Acciones clave | Datos/endpoints | E2E propuesto | Unit/Integración | P |
|---|---|---|---|---|---|---|---|---|---|---|
| EMP-01 | Personal | Lista de Personal | `/employees` | `hr.records` o `users.view`; acciones `users.create/edit/delete` | EMP-M01..M06 | Filtros por columna, mosaicos Todo/Activos/Inactivos, alta, importar, expediente, editar, menú de cuenta | `POST /hr/query` o `/users/query`, `/hr/stats`, `/departments`, `/permissions/roles`, `/users/availability`, baja/reactivación/eliminación | Lista/filtros; alta/importar; abrir expediente; baja/reactivar/eliminar; móvil | Unit: `useEmployeesList`; Integración: `personal.flow` + guard `/users/query` | P0 |
| EMP-02 | Personal | Alta de empleado/cuenta | `/employees/new` | `users.create` | — | Persona, acceso, organización, documentación condicional, disponibilidad, crear/cancelar | `POST /users`, `/users/availability`, `/departments`, `/permissions/roles`, `/hr/catalogs/document-types`, `/hr/:id/documents`, alta en reloj | Alta mínima; depto/subárea; roles adicionales; duplicados; docs obligatorios | Unit: `useUserForm`; Integración: `personal.flow` | P0 |
| EMP-03 | Personal | Importar desde Excel | `/employees/import` | `users.create` | — | Examinar/arrastrar archivo, quitarlo, importar, plantilla, filas omitidas | `GET /users/import/template`, `POST /users/import` | Subida real `.xlsx`; archivo inválido; filas omitidas; sin permiso | Unit: `user-import.service`; Integración: `users-import.flow` | P1 |
| EMP-04 | Personal | Expediente del empleado | `/employees/:id` | `hr.records`; reloj `time_clock.write/manage` | EMP-M03, M07..M09 | Tabs Actividad/Documentos/Reloj/Info; foto; editar; cuenta; baja/reactivar; credencial; documentos; alta en reloj; huellas | `/hr/:id`, `/overview`, `/documents`, `/photo`, baja/reactivación, `/time-clock/employees/:userId/clock-alta`, huellas | Tabs; baja/reactivación desde ficha; subir/eliminar documento; credencial; gating de Reloj | Integración: `hr-overview.flow`, `photo.flow`; nueva de documentos | P0 |
| EMP-05 | Personal | Editar expediente | `/employees/:id/edit` | `hr.records` | — | Foto; datos personales/laborales/contacto; modo de checada; guardar/cancelar | `GET/PATCH /hr/:id/profile`, `PUT /hr/:id/discounts`, `/photo`, catálogos | Persistencia de depto/subárea/modo de checada; validaciones RFC/CURP/NSS/teléfono/CP | Unit: validaciones de perfil/payload | P1 |
| EMP-06 | Personal | Cuenta del empleado | `/employees/:id/account` | `hr.records` o `users.view`; edita `users.edit` | EMP-M01, M02 | Editar usuario/rol/roles extra/contraseña/depto/subárea; abrir expediente; guardar | `GET/PUT /users/:id`, `/users/availability`, catálogos | Duplicados inline; contraseña; roles adicionales; URL directa | Unit: `useUserForm.handleSubmit`; Integración: update/duplicados | P1 |
| EMP-07 | Personal | Historial de la cuenta | `/employees/:id/history` | `hr.records` o `users.view`; excepciones `users.permissions` | EMP-M10 | Timeline, filtros por familia, dona, permisos por módulo, excepción | `/users/:id`, `/history`, `/permissions`, `PUT/DELETE /users/:id/permissions/:permission` | Carga/filtros; fijar/quitar excepción; gating sin permiso | Unit: `historyStats`; Integración: excepciones | P1 |
| HR-01 | RH | Expedientes de empleados | `/employees/records` | `hr.records` | HR-M01 | KPIs; filtros; subir documento; ver documento; avisar faltantes por fila/masivo | `/dashboard/hr-records`, `/hr/:id/documents`, `/hr/:id/notify-missing-records`, `/hr/notify-missing-records` | Filtros; subir documento; aviso por fila y masivo; toast | Unit: estados de expediente; Integración: notify | P1 |
| HR-02 | RH | Actas administrativas | `/employees/disciplinary-reports` | `hr.records`; acciones `hr.disciplinary_reports` | HR-M02, M03 | KPIs/filtros; nueva acta; ver; eliminar | `/hr/disciplinary-reports/query`, `POST`, `DELETE /:id` | Alta; filtros; detalle; eliminar; gating | Unit: resumen/filtros; Integración: CRUD actas | P1 |
| HR-03 | RH | Detalle de acta | `/employees/disciplinary-reports/:id` | `hr.records`/`hr.disciplinary_reports` | — | KPIs, datos de persona, descripción/sanción, visor, PDF, volver | `GET /hr/disciplinary-reports/:id`, PDF cliente | Render; descarga PDF; 404 | Unit: builder PDF | P2 |
| HR-04 | RH | Catálogo de documentos | `/employees/catalogs/documents` | `hr.records`; administra `catalogs.manage` | HR-M04, M05 | KPIs; nuevo/editar inline; obligatorio; activar/desactivar; eliminar definitivo; filtros | `/hr/catalogs/document-types` | Alta/edición; obligatorio; baja/activación; borrado; RH sólo lectura | Unit: validación de nombre; Integración: CRUD tipos | P2 |
| HR-05 | RH | Vacaciones y permisos | `/hr/leave` | `time_clock.write`; lectura `time_clock.view/payroll.view` | — | KPIs/filtro; aprobar/rechazar pendientes; historial con goce | `/nom/leave/requests`, `POST /:id/decide` | Aprobar/rechazar; filtros; gating; tipos sin UI | Integración: `leave.flow`; Unit: `nom.logic` | P1 |
| HR-06 | RH | Convenios y acuerdos | `/hr/jornada-acuerdos` | `time_clock.write`; firma | — | KPIs; registrar convenio art. 58; vigencia; evidencia ≥20; firmar como patrón; acuerdos de método | `/nom/distribution-agreements`, `/nom/record-agreements`, `POST /:id/employer-sign` | Registrar; evidencia corta; firma; gating | Integración: `distribution.flow`, `record-agreement.flow` | P1 |
| DEP-01 | Organización | Departamentos | `/departments` | Sin gate de ruta; escritura `departments.manage` | DEP-M01..M03 | Ver detalle; editar; baja lógica/definitiva; búsqueda | `/departments`, `/departments/query`, `POST/PUT/DELETE` | Lista/alta/edición/desactivación; eliminación definitiva; botones sin permiso | Unit: vista/catálogo; Integración: CRUD/guard | P1 |
| DEP-02 | Organización | Detalle de departamento | `/departments/:id` | Sin gate; escritura `departments.manage` | DEP-M04..M06 | KPIs; agregar/editar/quitar/reactivar subárea; eliminar departamento | `/departments/:id`, `/subareas` | Agregar subárea; editar/quitar/reactivar; eliminar depto | Unit: contadores; Integración: subáreas | P1 |
| DEP-03 | Organización | Subáreas | `/subareas` | Sin gate; escritura `departments.manage` | DEP-M07..M09 | KPIs; crear/editar; reactivar; baja/definitivo | `/subareas`, `/subareas/query`, `/departments` | CRUD completo; gating; bug de botones visibles sin permiso | Unit: validación depto+nombre; Integración: CRUD | P1 |

### 1.4 Horarios, tiempo extra y nómina

| ID | Módulo | Pantalla | Ruta | Permiso | Modales | Acciones clave | Datos/endpoints | E2E propuesto | Unit/Integración | P |
|---|---|---|---|---|---|---|---|---|---|---|
| SCH-01 | Horarios | Lista/tablero | `/schedules` | `schedules.view`; editar `schedules.manage` | SCH-M02 | Filtros/búsqueda; tabla con 7 días, semana, horas, reglas, asignados, estado; nuevo; editar; baja/reactivar suave; recarga por eventos | `GET /schedules?includeInactive=true`, `PATCH /schedules/:id {active}` | Filtros; editar; desactivar/reactivar; 7 días verde/gris; sin overflow | Integración: active/asignados | P0 |
| SCH-02 | Horarios | Alta de horario | `/schedules/new` | `schedules.view`; `POST` `schedules.manage` | SCH-M01 | 7 días, descanso, tolerancias, comida, mínimo HE, turno nocturno, resumen, guardar/cancelar | `POST /schedules`; defaults `nom_settings`; legalidad LFT | Alta 5+2; 7 días → 400; semana > tope → 400; nocturno; formato inválido | Unit: `validateScheduleLegality`; Integración: POST legal/400 | P0 |
| SCH-03 | Horarios | Edición de horario | `/schedules/:id/edit` | `schedules.view`; `PATCH` `schedules.manage` | SCH-M01 | Mismos campos; faltantes como descanso; persistencia; 404/409 | `GET /schedules`, `PATCH /schedules/:id` | Editar y reabrir; duplicado; 404; nocturno; 7 días | Integración: 200/400/404/409 | P1 |
| SCH-04 | Horarios | Asignar horario | `/schedules/assign` | `schedules.view`; asignar `schedules.manage` | SCH-M03 | Selector horario/depto/búsqueda; dos columnas; flechas; +/−; aviso de reemplazo; una sola asignación vigente | `/schedules/:id/assignees`, `/assignments/query`, `/assignments`, `/assignments/remove` | Asignar sin horario; reemplazo con modal actual→nuevo; quitar; una vigente; horario inactivo | Integración: assign/cierra previa; Unit: detección reemplazo | P0 |
| OT-01 | Tiempo extra | Aprobación de tiempo extra | `/schedules/overtime/approval` | `overtime.view`; decidir `overtime.approve`; semana `time_clock.write` | OT-M01 | Periodo/depto/búsqueda; estatus; tabla diaria; aprobar directo; rechazar con motivo; export; KPIs NOM dobles/triples/ilegal; confirmar semana | `POST /overtime/query`, `/overtime/approvals`, `/schedules/overtime/export`, `/nom/overtime/weekly` | RH sólo lectura; aprobar/rechazar; motivo; dobles/triples; confirmar semana | Unit: `weekly-overtime-engine`; Integración: decide/ledger | P0 |
| PAY-01 | Nómina | Pre-nómina semanal | `/schedules/payroll` | `payroll.view`; review `payroll.review`; close `payroll.close` | PAY-M01..M04 | Semana/depto/búsqueda; KPIs; costo plantilla; barras; tabla resumen/detallada; verificar/mark-all/cerrar/reabrir; avisos | `/schedules/weekly-attendance`, `/payroll/review-state`, `/reviews`, `/mark-all`, `/close`, `/reopen` | Verificar→cerrar→reabrir; pendientes bloquean cierre; cambio semana; campana | Integración: close 409/snapshot/reopen | P0 |
| PAY-02 | Nómina | Historial de pre-nóminas | `/schedules/payroll/history` | `payroll.view`; reabrir `payroll.close` | — | Semanas, estado, quién/cuándo, resumen, revisión por depto, reabrir | `GET /schedules/payroll/closures`, `POST /reopen` | Semana cerrada aparece; expandir revisión; reabrir; RH sin acción | Integración: snapshot/reopen | P1 |
| PAY-03 | Nómina | Puestos y configuración | `/payroll/settings` | `payroll.close`/`payroll.view` | PAY-M05, M06 | Tabs Puestos/Config; CRUD perfiles; salario/SBC; desactivar desasigna; config ISR/IMSS; calcular recibo | `/payroll/positions`, `/payroll/settings`, `/payroll/calculate` | Crear/editar puesto; baja desasigna; config/calcular; JSON inválido | Unit: `payroll-engine`; Integración: puestos/settings | P1 |
| PAY-04 | Nómina | Asignar personal a puesto | `/payroll/assign` | `payroll.close`/`payroll.view` | — | Selector de puesto activo; depto/búsqueda; KPIs; asignar/quitar individual/lote; badge actual | `/payroll/positions`, `/users/people`, `PUT /payroll/positions/:id/assign` | Asignar/quitar/lote; persona con otro puesto; puesto inactivo | Integración: assign mueve/limpia | P1 |

### 1.5 Relojes, checadas y agente

| ID | Módulo | Pantalla | Ruta | Permiso | Modales | Acciones clave | Datos/endpoints | E2E propuesto | Unit/Integración | P |
|---|---|---|---|---|---|---|---|---|---|---|
| CLK-01 | Checadas | Checadas (resumen) | `/hr/time-clock` | `time_clock.view`; sync `time_clock.sync`; admin `time_clocks.manage` | CLK-M01 | Filtros hoy/ayer/7d/custom, reloj, método, empleado; tabla; importar rango; sincronizar; estados; reintentar; CSV | `/time-clock/status`, `/query`, `/import`, `/sync`, `/clocks/:serial/events` | Sync 409/503; importación; reintento; CSV; gating | Integración: sync cursor; Unit: normalización/verificación serial | P1 |
| CLK-02 | Checadas | Asistencias (entradas/salidas) | `/hr/time-clock/entries-exits` | `time_clock.view` | — | Día/semana/quincena/mes; KPIs; depto/empleado/incluir bajas; tabla; export PDF/CSV | `POST /schedules/attendance/time-clock`, `/time-clock/report/export` | Export; WEB no vincula reloj; quincena/mes; inactivos | Integración: WEB/CLOCK/HYBRID; Unit: rangos | P0 |
| CLK-03 | Checadas | Padrón del reloj | `/hr/time-clock/roster` | `time_clock.view`; revisar `time_clock.sync`; baja `users.edit/hr.records`; link `time_clock.link` | — | Revisar padrón; nuevos/bajas/reaparecieron; motivo; aplicar baja; descartar; última revisión | `/time-clock/roster`, `/removal-categories`, `/:number/removal`, `/:number/dismiss` | Correr padrón; motivo <3 bloquea; descartar; guardia sospechosa | Unit: roster-plan; Integración: applyRemoval | P1 |
| CLK-04 | Checadas | Empleados del reloj | `/hr/time-clock/employees` | `time_clock.view`; link `time_clock.link` | CLK-M05 | KPIs En reloj/Vinculados/Sin vincular/Sugerencias; vincular/cambiar/desvincular; lote sugerencias | `/time-clock/employees/query`, `/link-suggested`, `PUT/DELETE /:number` | Vincular/desvincular; lote; canLink=false; confianza | Unit: matching; Integración: link/unlink | P1 |
| CLK-05 | Checadas | Diferencias del reloj | `/hr/time-clock/employees/differences` | `time_clock.view`; conciliar `time_clock.link` | — | Dos columnas; búsquedas; elegir; asignar/cambiar/desvincular/cancelar; read-only | `/employees/query`, `/users/employees`, `PUT/DELETE /time-clock/employees/:number` | Asignar/desvincular; read-only; ya asignada; filtros | Integración: link/unlink; Unit: selección | P1 |
| CLK-06 | Relojes | Dashboard del reloj | `/time-clocks/dashboard` | `time_clocks.manage` | CLK-M06, M02..M04 | Tabs Estado/Personas/Eventos/Cámara/Lector/Relojes; selector; KPIs; alertas; gráfica; checadas; lector; cámara | `/time-clock/summary`, `/people/unified`, `/clocks/:serial/*`, fingerprint | Tabs; estados online/offline/credenciales; alertas; lector; cámara | Unit: builder alertas; Integración: summary offline | P1 |
| CLK-07 | Relojes | Personas del reloj | `/time-clocks/people` | `time_clocks.manage`/`time_clock.write` | CLK-M06, M07 | Selector; búsqueda; actualizar; biométricos; tarjetas; ficha; renombrar; baja; foto fallback | `/clocks/:serial/people`, `/biometrics`, `PATCH/DELETE`, tarjetas | Renombrar; tarjeta sólo dígitos; baja; foto fallback; sin permiso | Unit: tarjeta; Integración: escrituras | P1 |
| CLK-08 | Relojes | Inspect del reloj | `/time-clocks/inspect` | `time_clocks.manage` | — | Selector; periodo; actualizar; tabs Resumen/Personas/Tarjetas/Eventos; tablas; identidad/hora | `/inspect/overview`, `/users`, `/cards`, `/events?days` | Tabs/periodo; paginación; sin respuesta | Unit: tipos de evento | P2 |
| CLK-09 | Relojes | Relojes checadores | `/time-clocks` | `time_clocks.manage`; agent jobs `time_clock.write` | CLK-M01..M04, AGT-01 | Tarjetas estado; detalle config; probar conexión; sincronizar; editar; baja; historial; jobs agente | `/time-clock/status`, `/clocks/:serial/settings`, CRUD `/clocks`, `/sync`, `/agent/jobs` | Probar ok/error; sync 409/503; URL inválida/duplicada; baja+alta; jobs | Integración: register/sync mock | P0 |
| AGT-01 | Agente | Trabajos del agente | `/time-clocks` | Encolar `time_clock.write` | — | Reloj, acción SYNC/PERSON_ADD/REMOVE/CARD_ADD; encolar; recientes; read-only | `POST /agent/jobs`, `GET /agent/jobs/recent` | CARD_ADD; validaciones; read-only; fallidos | Unit: DTO por acción; Integración: agent.flow | P2 |

### 1.6 Configuración

| ID | Módulo | Pantalla | Ruta | Permiso | Modales | Acciones clave | Datos/endpoints | E2E propuesto | Unit/Integración | P |
|---|---|---|---|---|---|---|---|---|---|---|
| SET-01 | Configuración | Configuración general | `/settings/general` | `time_clock.write` | SET-M1, M2 | Tabs Operación/Asistencia/Límites y retención/Checada web; guardar; archivar registros vencidos; zona horaria de solo lectura; ayuda contextual | `GET/PUT /nom/config`, `POST /nom/retention/archive`, `GET /auth/me` | Guardar por tab; recorte de límites; archivar con confirmación; toggles de checada web | Integración: `nom.flow`; Unit: validación de límites | P1 |
| SET-02 | Configuración | Catálogos | `/settings/catalogs` | Ruta `time_clock.write` o `hr.records`; escrituras `catalogs.manage` | SET-M3, M4 | Tabs Permisos/Documentos/Departamentos/Puestos; alta/edición/baja lógica; tablas con búsqueda | `/nom/leave/types`, `/hr/catalogs/document-types`, `/departments`, `/payroll/positions` | CRUD por tab; baja lógica; HelpTip; permisos ADMIN vs CLIENT_ADMIN | Integración: `leave.flow` + nueva de catálogos | P1 |

## 2. Matriz de subpantallas y tabs

Las rutas con tabs se prueban como **una pantalla por tab**: cada tab debe cargar sin errores, conservar filtros/estado y ejecutar sus acciones. Los IDs de tab se usan en los nombres de los casos E2E.

| ID | Padre | Subpantalla/tab | Qué cubrir | Modales | E2E propuesto | Unit | P |
|---|---|---|---|---|---|---|---|
| PLAT-04-T1 | PLAT-04 | Resumen | KPIs, checklist de puesta en marcha, datos del cliente | PLAT-M2 | Carga y checklist | — | P1 |
| PLAT-04-T2 | PLAT-04 | Módulos | Toggles de módulos, límites, guardado | — | Activar/desactivar módulo y persistir | — | P1 |
| PLAT-04-T3 | PLAT-04 | Cobros | Kardex, registrar cargo, marcar pagado | PLAT-M5 | Registrar cargo y pagar | Integración `tenant-payments` | P1 |
| PLAT-04-T4 | PLAT-04 | Actividad | Bitácora del cliente | — | Lectura y filtros | — | P2 |
| PLAT-06-T1 | PLAT-06 | Roles | Lista, alta, edición, duplicar, baja/activación | PLAT-M8, M9 | CRUD rol y errores de clave | Unit `role-key` | P0 |
| PLAT-06-T2 | PLAT-06 | Matriz | Cambiar celdas, barra de cambios, revisar y aplicar | PLAT-M18 | Cambiar 2 celdas→revisar→aplicar | Integración matriz | P0 |
| PLAT-06-T3 | PLAT-06 | Acceso por persona | Miembros, roles, excepciones, simulador | PLAT-M10, M15..M17, M19 | Fijar/quitar excepción; quitar miembro | Integración excepciones | P0 |
| PLAT-06-T4 | PLAT-06 | Políticas | Reglas ABAC, alta/edición/borrado, activar/desactivar | PLAT-M13, M14 | Estado vacío de acciones y flujo con regla | Integración políticas | P1 |
| PLAT-06-T5 | PLAT-06 | Catálogo | Permisos, alcances, sensibilidad, alta/edición/toggle | PLAT-M11, M12 | Crear permiso y desactivarlo | Integración catálogo | P1 |
| PLAT-06-T6 | PLAT-06 | Actividad | Bitácora de control de acceso | — | Lectura/paginación | Integración activity | P2 |
| EMP-04-T1 | EMP-04 | Actividad | Timeline, documentos recientes, checadas, actas, horario | — | Carga con datos y vacío | — | P1 |
| EMP-04-T2 | EMP-04 | Documentos | Subir/ver/descargar/eliminar documentos, faltantes | — | Subir y eliminar; gating | Integración documentos | P1 |
| EMP-04-T3 | EMP-04 | Reloj | Alta en reloj, huellas, estado del reloj | EMP-M08, M09 | Alta/huella con mock; sin permiso | — | P2 |
| EMP-04-T4 | EMP-04 | Datos del empleado | Datos personales/laborales/contacto | — | Lectura completa | — | P2 |
| NOM-01-S1 | NOM-01 | Checada web | Siguiente paso, hora servidor, modo, nota, geo | — | Secuencia 4 pasos; canal habilitado | Integración punch remoto | P0 |
| NOM-01-S2 | NOM-01 | Mis marcajes | Rango, origen CLOCK/ACCESS/WEB/APP, discrepancia | — | Filtrar y reportar discrepancia | Integración | P1 |
| NOM-01-S3 | NOM-01 | Teletrabajo | Política, aceptación, checklist inicial/periódico | — | Aceptar y checklist incompleto | Integración | P1 |
| NOM-01-S4 | NOM-01 | Registro electrónico | Solicitudes fuera de jornada, métodos, conformidad | — | Aceptar/rechazar conformidad | Integración | P1 |
| NOM-01-S5 | NOM-01 | Vacaciones y permisos | Saldo, solicitud, cancelación | — | Crear/cancelar; saldo insuficiente | Integración `leave.flow` | P1 |
| NOM-02-T1 | NOM-02 | Política y avisos | Editar 3 textos, subir versión, re-aceptación | NOM-M01 | Guardar y verificar versión | Unit versión política | P1 |
| NOM-02-T2 | NOM-02 | Teletrabajadores | Alta/baja, modalidad, domicilio, badges | NOM-M02 | Alta y baja | Integración registro | P1 |
| NOM-02-T3 | NOM-02 | Checklists | Últimos checklists recibidos, vacío | — | Lectura/vacío | — | P2 |
| NOM-02-T4 | NOM-02 | Comunicaciones | Registrar contacto fuera de jornada, motivo ≥5 | NOM-M03 | Validación y alta | Unit validación | P2 |
| CLK-06-T1 | CLK-06 | Estado | KPIs, alertas, dispositivos, reintento | CLK-M06 | Offline/online, alertas, reintentar | Unit summary | P1 |
| CLK-06-T2 | CLK-06 | Personas | Personas unificadas de todos los relojes | CLK-M06 | Cambiar reloj/todos; abrir ficha | — | P1 |
| CLK-06-T3 | CLK-06 | Eventos | Checadas y eventos del reloj | — | Carga/paginación | — | P1 |
| CLK-06-T4 | CLK-06 | Cámara | Streams HTTP/RTSP, sin streams, error | — | Sin streams y RTSP | — | P2 |
| CLK-06-T5 | CLK-06 | Lector de huella | No configurado, ok, calidad baja, error | — | Probar lector y error | — | P2 |
| CLK-06-T6 | CLK-06 | Relojes | CRUD de relojes, sync, historial | CLK-M02..M04 | Alta/edición/sync | Integración clock | P0 |
| PAY-03-T1 | PAY-03 | Puestos de nómina | CRUD perfiles, salario/SBC, activar/desactivar, asignar | PAY-M05, M06 | Crear/editar/baja desasigna | Unit `payroll-engine` | P1 |
| PAY-03-T2 | PAY-03 | Configuración general | ISR/IMSS JSON, salario/jornada, prestaciones, calcular | — | Guardar/calcular/JSON inválido | Unit `payroll-engine` | P1 |
| SET-01-T1 | SET-01 | Operación | Semana, zona horaria, tolerancias, defaults | — | Guardar y recargar | Integración `nom.flow` | P1 |
| SET-01-T2 | SET-01 | Asistencia | Reglas de asistencia, retardos, HE | — | Persistencia y límites | Integración config | P1 |
| SET-01-T3 | SET-01 | Límites y retención | Límites legales, retención, archivar | SET-M2 | Archivar con confirmación | Integración retención | P1 |
| SET-01-T4 | SET-01 | Checada web | Toggles de checada web/remota, consentimiento | — | Persistencia y efecto | Integración config | P1 |
| SET-02-T1 | SET-02 | Permisos | Tipos de permiso, goce, CRUD | SET-M3, M4 | Alta/edición/baja | Integración `leave.flow` | P1 |
| SET-02-T2 | SET-02 | Documentos | Tipos de documento, obligatorio, CRUD | SET-M3, M4 | Alta/edición/baja | Integración documentos | P1 |
| SET-02-T3 | SET-02 | Departamentos | Catálogo de departamentos | SET-M3, M4 | Alta/edición/baja | Integración | P1 |
| SET-02-T4 | SET-02 | Puestos | Perfiles de puesto/salario | SET-M3, M4 | Alta/edición/baja | Integración puestos | P1 |

## 3. Matriz de modales y diálogos

Cada fila incluye el disparador, la validación que debe probarse y la acción que muta estado. Los modales de confirmación se prueban en sus dos ramas: **cancelar no cambia nada** y **confirmar aplica el efecto**.

### 3.1 Acceso y plataforma

| ID | Modal | Abre en | Contenido/validación | Acciones | E2E propuesto | Unit | P |
|---|---|---|---|---|---|---|---|
| AUTH-M1 | ForcePasswordChange | Post-login, bloqueo no cerrable | Contraseña actual/nueva/confirmar; nueva ≥6, igual a confirmar, distinta a la actual | Cambiar contraseña | Login provisional→cambio→inicio | Unit del model de validación | P1 |
| PLAT-M1 | CreateTenantDialog | PLAT-01/03 | Nombre, slug, zona horaria, plan, límite, admin; estado final con URL/usuario/contraseña | Crear, copiar datos, cerrar | Alta completa; slug reservado; correo inválido | Unit `useCreateTenant` | P0 |
| PLAT-M2 | PlanAssignDialog | PLAT-01/03/04 | Plan o sin plan; uso actual vs límite; precio; aviso de exceso | Guardar, cancelar | Asignar plan; bajar plan con exceso | Integración `plans.flow` | P1 |
| PLAT-M3 | AgentTokenDialog | PLAT-01/03 | Nombre; token en claro una vez; agentes y estado | Crear, rotar, revocar/reactivar, copiar | Crear/rotar/revocar token | Integración `agent.flow` | P1 |
| PLAT-M4 | TicConfirm suspender/reactivar cliente | PLAT-01/03 | Nombre y consecuencia (corta sesiones / reactiva) | Confirmar, cancelar | Suspender y reactivar; cancelar no cambia | Integración impersonación | P0 |
| PLAT-M5 | Registrar cargo | PLAT-04 | Concepto, periodo `YYYY-MM`, monto MXN, vencimiento | Registrar, cancelar | Cargo aparece en kardex; monto vacío no guarda | Integración `tenant-payments` | P1 |
| PLAT-M6 | PlanFormDialog | PLAT-05 | Nombre, personas, relojes, precio; nombre ≥2, enteros ≥1, precio ≥0 | Guardar, cancelar | Alta/edición; clave duplicada 409 | Unit `usePlanForm` | P1 |
| PLAT-M7 | TicConfirm baja/reactivar plan | PLAT-05 | Plan y consecuencia (baja lógica conserva clientes) | Baja/reactivar, cancelar | Baja y reactivación | Integración `plans.flow` | P1 |
| PLAT-M8 | RoleEditorDialog | PLAT-06 | Nombre, descripción, modo (blanco/copiar), rol a copiar, grupo, staff, clave/orden | Crear/guardar, cancelar | Crear/duplicar; clave repetida | Unit `role-key` | P0 |
| PLAT-M9 | Confirm rol eliminar/desactivar/activar | PLAT-06 | Rol y personas afectadas | Confirmar, cancelar | Desactivar/eliminar; aviso de impacto | Integración roles | P0 |
| PLAT-M10 | Confirm quitar persona del rol | PLAT-06 | Persona y rol | Quitar, cancelar | Quitar y refrescar miembros | Integración members | P1 |
| PLAT-M11 | PermissionFormDialog | PLAT-06 | Nombre, descripción, módulo, presets de alcance, sensibilidad, clave/orden | Crear/guardar, cancelar | Alta de permiso; validaciones | Integración catálogo | P1 |
| PLAT-M12 | Confirm activar/desactivar permiso | PLAT-06 | Clave y consecuencia; historial se conserva | Confirmar, cancelar | Desactivar y comprobar cierre de rutas | Integración catálogo | P1 |
| PLAT-M13 | PolicyEditorDialog | PLAT-06 | Acción, efecto DENY/ALLOW, condiciones, prioridad, roles; borrado con confirmación inline | Guardar, eliminar, cancelar | Catálogo vacío; flujo con acción sembrada | Unit política/condiciones | P1 |
| PLAT-M14 | Confirm activar/desactivar política | PLAT-06 | Regla y consecuencia | Confirmar, cancelar | Desactivar y verificar evaluación | Integración políticas | P2 |
| PLAT-M15 | ExceptionDialog | PLAT-06 | Permiso, alcance, motivo, vencimiento (default/fecha/nunca) | Guardar, cancelar | Excepción temporal y revocación | Integración excepciones | P0 |
| PLAT-M16 | Confirm quitar excepción | PLAT-06 | Permiso y persona | Limpiar excepción, cancelar | Alcance vuelve al rol | Integración excepciones | P1 |
| PLAT-M17 | Confirm quitar rol desde Acceso | PLAT-06 | Persona y rol | Quitar, cancelar | Quitar rol y recalcular acceso | Integración members | P1 |
| PLAT-M18 | ChangesReviewDialog | PLAT-06 | Resumen por rol/permiso/alcance, sensibles e impacto | Aplicar, seguir editando | Matriz 2 celdas→aplicar→persistir | Integración matriz | P0 |
| PLAT-M19 | AccessSimulator | PLAT-06 | Persona, permiso, acción/contexto y campos de política | Simular (solo lectura), cerrar | Veredicto RBAC→ABAC | Integración simulate | P2 |
| PLAT-M20 | RolesHelpDialog | PLAT-06 | Ayuda de roles/alcances/políticas | Cerrar | Abrir/cerrar | — | P2 |
| SET-M1 | SettingsHelpDialog | SET-01 | Título, qué hace, ejemplo y nota por tab | Cerrar | Texto correcto por tab | Unit mapa de contenido | P2 |
| SET-M2 | Confirm archivar retención | SET-01 | Qué se archiva, no se borra | Archivar, cancelar | Archivar y ver conteos | Integración retención | P1 |
| SET-M3 | Catálogo crear/editar | SET-02 | Permiso (clave, nombre, goce), documento (nombre/obligatorio), departamento, puesto/salario | Guardar, cancelar | Alta/edición por tab; nombre ≥3 | Integración catálogos | P1 |
| SET-M4 | Confirm dar de baja catálogo | SET-02 | Registro y consecuencia; historial se conserva | Baja, cancelar | Baja lógica y desaparición de tabla | Integración catálogos | P2 |
| AUD-M1 | Detalle de auditoría | AUD-01 | Fecha, cliente, usuario, módulo, acción, entidad, IP, UA, roles, permisos, anterior/nuevo, metadata | Cerrar | Abrir detalle y validar bloques JSON | Integración `GET /audit/:id` | P1 |

### 3.2 Personal, expediente y organización

| ID | Modal | Abre en | Contenido/validación | Acciones | E2E propuesto | Unit | P |
|---|---|---|---|---|---|---|---|
| EMP-M01 | Editar usuario/cuenta | EMP-01/04/06 | Usuario, rol, contraseña opcional, roles extra, depto/subárea; datos de persona si no hay expediente | Guardar, cancelar, abrir expediente | Abrir/editar; duplicados; roles extra | Unit `useUserForm` | P1 |
| EMP-M02 | Cambiar contraseña | EMP-01 menú | Nueva contraseña; no vacía; `mustChangePassword` | Guardar, cancelar | Abrir/cancelar; guardar y login con nueva | Unit validación | P2 |
| EMP-M03 | Dar de baja | EMP-01/04 | Motivo ≥3; aviso de que no podrá iniciar sesión; baja en relojes | Dar de baja, cancelar | Baja desde ficha; motivo corto bloquea | — | P1 |
| EMP-M04 | Reactivar cuenta | EMP-01 | Confirmación simple; alta en relojes | Reactivar, cancelar | Reactivar y ver estado | — | P1 |
| EMP-M05 | Eliminar cuenta | EMP-01 | Cuenta inactiva; confirmación destructiva; 409 por historial | Eliminar, cancelar | Eliminar y ver fila ausente | — | P1 |
| EMP-M06 | Forzar eliminación | Tras fallo EMP-M05 | Reasignación de registros; pérdida definitiva | Forzar, cancelar | Caso determinista con historial | — | P2 |
| EMP-M07 | Credencial de empleado | EMP-04 | Preview canvas: foto, nombre, número, puesto, depto, QR | Descargar, cerrar | Preview y descarga; error de render | Unit `useEmployeeCredential` | P2 |
| EMP-M08 | Alta en reloj | EMP-04 tab Reloj | Nombre, número, reloj destino; sólo si online y con escritura | Alta, no, cerrar | Alta con mock; reloj offline | — | P2 |
| EMP-M09 | Registro de huella | EMP-04 tab Reloj | Captura, calidad, alta; errores estación/auth/reloj | Repetir, alta, cerrar | Calidad baja; error de estación | — | P2 |
| EMP-M10 | Excepción de permiso | EMP-07 | Permiso, alcance, motivo, vencimiento; fecha válida | Guardar, cancelar; quitar | Fijar con vigencia y quitar | Unit normalización | P2 |
| HR-M01 | Avisar faltantes (masivo) | HR-01 | Conteo de pendientes | Avisar, cancelar | Confirmar y ver toast | — | P2 |
| HR-M02 | Nueva acta administrativa | HR-02 | Empleado, motivo, fecha ≤hoy, descripción ≥5, sanción | Guardar, cancelar | Alta y validaciones | Unit validación | P1 |
| HR-M03 | Eliminar acta | HR-02 | Persona y confirmación | Eliminar, cancelar | Eliminar y ver fila ausente | — | P2 |
| HR-M04 | Activar/desactivar tipo de documento | HR-04 | Nombre y efecto en expedientes nuevos | Desactivar/reactivar, cancelar | Toggle y persistencia | Integración tipos | P2 |
| HR-M05 | Eliminar tipo de documento | HR-04 | Sólo inactivo; confirmación destructiva | Eliminar, cancelar | Eliminar definitivo | Integración tipos | P2 |
| DEP-M01 | Nuevo departamento | DEP-01 | Nombre obligatorio; Enter crea | Crear, cancelar | Alta | — | P1 |
| DEP-M02 | Editar departamento | DEP-01 | Nombre precargado | Guardar, cancelar | Edición | — | P1 |
| DEP-M03 | Eliminar/desactivar departamento (lista) | DEP-01 | Activo=baja lógica; inactivo=definitivo | Eliminar, cancelar | Desactivación y eliminación | Integración CRUD | P1 |
| DEP-M04 | Editar subárea | DEP-02 | Nombre precargado | Guardar, cancelar | Edición | — | P2 |
| DEP-M05 | Quitar subárea | DEP-02 | Activa=desactivar; inactiva=definitivo | Eliminar, cancelar | Baja lógica/definitiva | Integración | P2 |
| DEP-M06 | Eliminar departamento (detalle) | DEP-02 | Baja lógica/definitiva; vuelve al listado | Eliminar, cancelar | Eliminar y volver | Integración | P2 |
| DEP-M07 | Nueva subárea | DEP-03 | Departamento obligatorio + nombre | Crear, cancelar | Alta; ambos obligatorios | — | P2 |
| DEP-M08 | Editar subárea | DEP-03 | Sólo nombre; no cambia departamento | Guardar, cancelar | Edición | — | P2 |
| DEP-M09 | Eliminar/desactivar subárea | DEP-03 | Activa=desactivar; inactiva=definitivo | Eliminar, cancelar | Baja lógica/definitiva | Integración | P2 |

### 3.3 Horarios, tiempo extra y nómina

| ID | Modal | Abre en | Contenido/validación | Acciones | E2E propuesto | Unit | P |
|---|---|---|---|---|---|---|---|
| SCH-M01 | Guardar horario | SCH-02/03 | Nombre, días de trabajo, horas/semana; nombre obligatorio; servidor 400/409 | Guardar (POST/PATCH), cancelar | Confirmar alta; cancelar; horario ilegal; edición | Unit mensaje/resumen; Integración 400/409 | P0 |
| SCH-M02 | Desactivar/activar horario | SCH-01 | Nombre y consecuencia; variante warning/success; loading | Desactivar/activar, cancelar | Desactivar→inactivo; reactivar; cancelar | Integración PATCH active | P0 |
| SCH-M03 | Cambiar horario (reemplazo) | SCH-04 | Tabla persona / actual / nuevo; sólo si ya tiene otro; nota de reemplazo | Cambiar, cancelar | Actual→nuevo; persona sin horario no abre modal; cancelar | Integración assign cierra previa | P0 |
| OT-M01 | Rechazar tiempo extra | OT-01 | N solicitudes; motivo opcional | Rechazar, cancelar | Rechazar con/sin motivo; estado y motivo | Integración approvals | P1 |
| PAY-M01 | Avisos de la semana | PAY-01 | Personas sin vínculo / sin horario | Cerrar | Campana con contador y ambos avisos | — | P2 |
| PAY-M02 | Verificar pre-nómina | PAY-01 | N de M departamentos; checkbox; estado; mark-all; cerrar | Marcar, marcar todos, cerrar, cancelar | Marcar/desmarcar; todos; cierre | Integración reviews | P0 |
| PAY-M03 | Verificar toda la pre-nómina | PAY-01 | N departamentos de la semana | Confirmar, cancelar | Confirmar habilita cierre; cancelar no cambia | Integración mark-all | P1 |
| PAY-M04 | Cerrar la semana | PAY-01/PAY-M02 | Semana y aviso de reapertura; 409 con pendientes | Cerrar, cancelar | Cerrar→cerrada; reabrir; pendientes bloquean | Integración snapshot/reopen | P0 |
| PAY-M05 | Nuevo/editar puesto de nómina | PAY-03 | Nombre, cargo, salario diario >0, SBC opcional | Guardar, cancelar | Crear/editar; validación; inactivo no editable | Integración positions | P1 |
| PAY-M06 | Desactivar/activar perfil de nómina | PAY-03 | Desactivar quita a personas; historial se conserva | Desactivar/activar, cancelar | Baja desasigna; reactivar | Integración positions | P1 |

### 3.4 Relojes, agente y NOM

| ID | Modal | Abre en | Contenido/validación | Acciones | E2E propuesto | Unit | P |
|---|---|---|---|---|---|---|---|
| CLK-M01 | Historial de sincronización | CLK-01/09 | KPIs intentos/fallos/última conexión; lista; error; sólo lectura | Actualizar, cerrar | Abrir/refrescar; vacío/error | — | P2 |
| CLK-M02 | Alta de reloj | CLK-09 | URL requerida, nombre, cuenta asistencia; serial leído; 400/409/503 | Dar de alta, cancelar | Alta mock; URL inválida/duplicada; error 503 | Unit normalización URL | P0 |
| CLK-M03 | Editar reloj | CLK-09 | Nombre ≤80, asistencia, permitir escritura | Guardar, cancelar | Persistir nombre/asistencia/escritura; error API | Unit DTO update | P0 |
| CLK-M04 | Baja de reloj | CLK-09 | Confirmación: deja de sincronizar, conserva checadas | Dar de baja, cancelar | Baja y alta nueva; cancelar no cambia | — | P0 |
| CLK-M05 | Vincular persona del reloj | CLK-04 | Número y reloj; buscador de usuario | Vincular, cancelar | Buscar/vincular; error; cancelar | — | P1 |
| CLK-M06 | Ficha de persona del reloj | CLK-06/07 | Foto, nombre, vínculo, checadas, rostros, tarjetas, huellas; renombre ≥2; tarjeta dígitos | Renombrar, tarjeta add/remove, cerrar | Renombrar inválido; tarjeta; foto fallback; sin permiso | Unit normalización tarjeta | P1 |
| CLK-M07 | Baja de persona del reloj | CLK-06/07 | Nombre, número; quita tarjetas y escribe en equipo | Dar de baja, no | Baja ok; cancelar; error de red | — | P1 |
| NOM-M01 | Editar política de teletrabajo | NOM-02 | 3 textareas; sin obligatorios; sube versión | Guardar, cancelar | Guardar y verificar versión/re-aceptación | Unit versión política | P1 |
| NOM-M02 | Alta de teletrabajador | NOM-02 | Usuario, modalidad, domicilio | Registrar, cancelar | Alta y aparición; usuario requerido | — | P1 |
| NOM-M03 | Registrar comunicación fuera de jornada | NOM-02 | Usuario, canal, motivo ≥5 | Registrar, cancelar | Motivo corto bloquea; alta exitosa | Unit validación | P2 |
| AGT-M01 | Agentes del cliente / token | Plataforma `/` y PLAT-03 | Nombre; token en claro una vez; agentes/versión/última conexión | Crear, rotar, copiar, revocar/reactivar | Crear/rotar/revocar; nombre vacío; token una vez | Integración `agent.flow` | P1 |

## 4. Matriz de acciones que mutan estado

Esta tabla es la lista de acciones que **deben** tener prueba de efecto, no sólo de clic. Las lecturas se cubren en la pantalla correspondiente.

| ID | Acción | Pantalla | Efecto | Confirmación | E2E | Unit/Integración | P |
|---|---|---|---|---|---|---|---|
| ACT-01 | Iniciar sesión | AUTH-01 | Crea sesión/JWT y redirige | No | Login válido/erróneo/cliente inválido | Integración `auth.flow` | P0 |
| ACT-02 | Cambiar contraseña forzada | AUTH-M1 | Actualiza contraseña y desbloquea | No | Flujo de bloqueo | Unit validación | P1 |
| ACT-03 | Entrar como cliente (impersonar) | PLAT-01/03 | Cambia tenant y registra auditoría | Sí, explícito | Entrar y volver | Integración impersonación | P0 |
| ACT-04 | Crear cliente | PLAT-M1 | Crea tenant, admin y límites | No, formulario | Alta completa | Integración tenancy | P0 |
| ACT-05 | Suspender/reactivar cliente | PLAT-M4 | Cambia estado y corta/restaura sesiones | Sí | Ambas ramas | Integración tenancy | P0 |
| ACT-06 | Asignar plan | PLAT-M2 | Actualiza plan y límites | No | Asignar y bajar plan | Integración plans | P1 |
| ACT-07 | Crear/editar/dar de baja plan | PLAT-05/M6 | CRUD lógico del catálogo | Sí en baja | CRUD y duplicado | Integración plans | P1 |
| ACT-08 | Crear/editar/desactivar rol | PLAT-06/M8 | Cambia RBAC del tenant | Sí al desactivar/eliminar | CRUD y protección system | Integración roles | P0 |
| ACT-09 | Aplicar matriz de permisos | PLAT-06/M18 | Persiste cambios masivos | Revisión + aplicar | Cambiar celdas y aplicar | Integración matrix | P0 |
| ACT-10 | Conceder/quitar excepción de permiso | PLAT-M15/M16 | Cambia acceso efectivo de una persona | Confirmación al quitar | Fijar y quitar | Integración exceptions | P0 |
| ACT-11 | Crear/editar/desactivar permiso | PLAT-M11/M12 | Catálogo RBAC/ABAC | Sí al desactivar | Alta y toggle | Integración catalog | P1 |
| ACT-12 | Guardar configuración / archivar retención | SET-01/M2 | Actualiza `nom_settings`; archiva registros | Sí al archivar | Guardar y archivar | Integración `nom.flow` | P1 |
| ACT-13 | Crear/editar empleado | EMP-02/05 | Crea/actualiza persona y cuenta | No | Alta y edición | Integración personal | P0 |
| ACT-14 | Actualizar cuenta/acceso | EMP-M01 | Cambia usuario, rol, depto y contraseña | No | Editar y duplicados | Integración users | P1 |
| ACT-15 | Baja/reactivación/eliminación de cuenta | EMP-M03..M06 | Cambia acceso y sincroniza relojes | Sí | Baja, reactivar, eliminar | Integración personal | P0 |
| ACT-16 | Subir/eliminar documento | EMP-04/HR-01 | Crea/borra documento del expediente | Eliminar sí | Subir/eliminar | Integración documentos | P1 |
| ACT-17 | Crear/eliminar acta | HR-M02/M03 | Registra sanción y PDF | Eliminar sí | Crear/eliminar | Integración actas | P1 |
| ACT-18 | Aprobar/rechazar permiso | HR-05 | Cambia estado y saldo | No (hoy) | Ambas ramas | Integración `leave.flow` | P1 |
| ACT-19 | Registrar/firmar convenio | HR-06 | Crea acuerdo y firma patronal | No | Registrar y firmar | Integración distribution | P1 |
| ACT-20 | CRUD departamento/subárea | DEP-01..03 | Crea/edita/baja organización | Sí en baja | CRUD y gating | Integración organization | P1 |
| ACT-21 | Crear/editar horario | SCH-02/03/M01 | Guarda 7 días y valida legalidad | Sí | Alta/edición y 400 | Integración schedules | P0 |
| ACT-22 | Activar/desactivar horario | SCH-M02 | Cambia disponibilidad para asignar/calcular | Sí | Ambas ramas | Integración schedules | P0 |
| ACT-23 | Asignar/reemplazar/quitar horario | SCH-04/M03 | Cierra vigencia previa y crea nueva | Sí si reemplaza | Reemplazo y una sola vigente | Integración assignments | P0 |
| ACT-24 | Aprobar/rechazar tiempo extra | OT-01/M01 | Cambia estatus y ledger | Rechazar pide motivo | Ambas ramas | Integración overtime | P0 |
| ACT-25 | Confirmar semana de tiempo extra | OT-01 | Congela snapshot semanal | Acción directa | Confirmar y recargar | Integración weekly ledger | P1 |
| ACT-26 | Verificar/cerrar/reabrir pre-nómina | PAY-01/M02..M04 | Reviews, snapshot y reapertura | Sí al cerrar | Flujo completo | Integración payroll | P0 |
| ACT-27 | Crear/editar/baja de puesto y asignar personal | PAY-03/04/M05/M06 | Perfiles salariales y asignación | Sí al desactivar | CRUD y asignación | Integración payroll | P1 |
| ACT-28 | Alta/edición/baja de reloj | CLK-M02..M04 | Registro y sincronización del equipo | Sí al dar de baja | Alta, edición, baja | Integración clock | P0 |
| ACT-29 | Probar conexión/sincronizar reloj | CLK-09 | Consulta/escritura al reloj | No | Ok/error/409/503 | Integración sync | P0 |
| ACT-30 | Correr padrón / aplicar baja / descartar | CLK-03 | Plan de bajas y auditoría | Baja con motivo | Motivo corto y éxito | Integración roster | P1 |
| ACT-31 | Vincular/desvincular número de reloj | CLK-04/05 | Asocia persona y número | Confirmación en conciliación | Vincular/desvincular/lote | Integración link | P1 |
| ACT-32 | Renombrar/agregar tarjeta/quitar persona del reloj | CLK-M06/M07 | Escribe en el equipo | Baja de persona sí | Renombrar, tarjeta, baja | Integración clock | P1 |
| ACT-33 | Checada remota / reportar discrepancia | NOM-01 | Crea marcaje o incidencia | No | Secuencia y discrepancia | Integración remote punch | P0 |
| ACT-34 | Editar política/alta teletrabajador/comunicación | NOM-02/M01..M03 | Configura NOM-037 y auditoría | No | Guardar/alta/motivo | Integración telework | P1 |
| ACT-35 | Aceptar conformidad / crear/cancelar permiso | NOM-01 | Acepta registro y solicita permiso | No | Aceptar, crear, cancelar | Integración `nom.flow`/`leave.flow` | P1 |
| ACT-36 | Encolar trabajo del agente | AGT-01 | Crea job local | No | Validación por acción | Integración `agent.flow` | P2 |
| ACT-37 | Activar módulos / marcar cargo pagado | PLAT-04/M5 | Cambia módulos o finanzas | No | Toggle y pago | Integración tenants | P1 |

## 5. Cobertura actual y huecos

### 5.1 E2E existentes (75 casos)

| Suite | Casos | Pantallas que toca |
|---|---:|---|
| `auth.spec.ts` | 4 | Login, multi-cliente, cuenta desactivada |
| `client-routes.spec.ts` | 7 | Login por tenant, rutas, guards |
| `landing.spec.ts` / `landing.mobile.spec.ts` | 3 | Landing pública y móvil |
| `home.spec.ts` | 4 | Consola plataforma / inicio cliente |
| `tenants.spec.ts` | 5 | Clientes, suspender/reactivar, alta, planes, entrar |
| `agent-console.spec.ts` | 2 | Token de agente y jobs |
| `roles.spec.ts` | 3 | Roles, tabs, matriz básica |
| `notifications.spec.ts` | 2 | Leído y persistencia |
| `client-settings.spec.ts` | 1 | Semana laboral |
| `personal.spec.ts` | 13 | Personal, cuenta, alta, baja, reactivación, borrado, import, puesto |
| `personal.mobile.spec.ts` | 1 | Personal móvil |
| `departments.spec.ts` | 5 | Departamentos, subárea, desactivación, subáreas |
| `schedules.spec.ts` | 4 | Horarios, alta, edición, asignación |
| `overtime-payroll.spec.ts` | 3 | Tiempo extra y pre-nómina |
| `payroll-verification.spec.ts` | 1 | Verificar/cerrar/reabrir |
| `access-time-clock.spec.ts` | 5 | Resumen, entradas/salidas, roster, empleados, diferencias |
| `time-clocks.spec.ts` | 6 | Relojes, dashboard, personas, inspect, edición, alta |
| `mi-jornada.spec.ts` / `.mobile` | 3 | Portal del trabajador y móvil |
| `nom-portal.spec.ts` | 3 | Teletrabajo y NOM |

**Riesgo detectado:** `schedules.spec.ts` todavía asume el asistente Tic (`agentScheduleName`, “Siguiente”, “Usar estos”), que ya no existe. Debe actualizarse al formulario de 7 días antes de usarlo como referencia.

### 5.2 Integración API existente

Auth, tenancy, platform guard, tenants, pagos, planes, personal, importación, expediente, foto, horarios/legalidad, nómina, HE, vacaciones, NOM, registro de jornada, teletrabajo, acuerdos, relojes, agente, auditoría por cursor, rate limit, timezone, RLS.

### 5.3 Huecos principales

| Área | Hueco | Acción |
|---|---|---|
| E2E Horarios | Spec desactualizado (Tic) | Reescribir `schedules.spec.ts` con formulario de 7 días y modales SCH-M01..M03 |
| E2E Horarios | Sin prueba de asignación con reemplazo | Añadir a `schedules.spec.ts` el modal actual→nuevo y una sola vigente |
| E2E Nómina | Sin `payroll/settings`, `payroll/assign` | Nuevo `payroll-settings.spec.ts` |
| E2E Nómina | Sin rechazo de HE ni confirmación semanal | Añadir a `overtime-payroll.spec.ts` |
| E2E Personal | Sin documentos, credencial, huella, actas, historial | Nuevos specs por pantalla |
| E2E Plataforma | Sin `/tenants/:id`, `/audit`, `/settings/catalogs`, roles avanzados | Nuevos specs y fixtures de plataforma |
| E2E Relojes | Sin roster apply/dismiss, sync 409/503, link lote, dashboard offline | Ampliar `access-time-clock`/`time-clocks` con mock |
| Unit web | Sólo existe `tenant-route/resolve.test.ts` | Añadir validadores, hooks de formularios, filtros y builders |
| Unit API | Falta auditoría de filtros/aislamiento, matriz RBAC, roster-plan, sync cursor | Añadir unit/integration específicos |
| Accesibilidad/móvil | Cobertura móvil sólo en Personal/Mi jornada/landing | Añadir smoke móvil de Horarios, Nómina y Relojes |

## 6. Orden de implementación de pruebas

### Fase 0 — estabilizar harness

1. Actualizar `schedules.spec.ts` al formulario actual.
2. Sembrar datos deterministas para pre-nómina cerrada, HE doble/triple, roles y reloj mock.
3. Revisar credenciales/tenant IDs y evitar dependencias entre suites.

### Fase 1 — P0 (bloqueantes)

1. `auth-shell`: login, cliente inválido, guards por rol, force password.
2. `personal-core`: alta, edición, baja/reactivación, cuenta, permisos.
3. `schedules-core`: lista, alta/edición, activar/desactivar, asignar/reemplazar.
4. `overtime-payroll-core`: aprobar/rechazar, verificar/cerrar/reabrir, snapshot.
5. `clocks-core`: alta/edición/baja de reloj, sync, roster, evitar doble asignación de horario.
6. `roles-core`: crear rol, matriz y aplicar, excepción de permiso.

### Fase 2 — P1 (flujo principal)

1. Expediente completo: documentos, credencial, actas, historial.
2. Organización: departamentos, subáreas, catálogos.
3. Nómina configurable: puestos, asignación, cálculo.
4. Relojes: vínculos, conciliación, personas, inspect.
5. Teletrabajo y portal NOM: política, aceptación, checklist, conformidad.
6. Plataforma: detalle de cliente, cargos, planes, agente.
7. Configuración y auditoría.

### Fase 3 — P2 y móvil

1. Ayudas, simuladores, historiales y lecturas secundarias.
2. Cámaras/lector de huella con mock.
3. Smoke móvil de las pantallas principales.
4. Manual: hardware real y correo real.

## 7. Criterio de “hecho” por fila

- **Pantalla:** E2E abre la ruta, verifica título/estado, ejecuta la acción principal y comprueba el cambio visible; unit/integración cubre la regla o endpoint asociado.
- **Tab:** E2E cambia de tab, valida contenido exclusivo y que no se rompe el estado global.
- **Modal:** E2E abre, valida campos, cancela sin cambios y confirma el efecto; unit prueba validaciones/payload.
- **Acción destructiva:** E2E verifica que cancelar no cambia nada, que confirmar aplica el efecto y que el permiso sin acción oculta/deniega el botón.
- **Permisos:** cada pantalla/acción P0 se prueba con rol permitido y rol denegado (403 o botón oculto).

## 8. Convención de nombres

- Specs: `<modulo>-<flujo>.spec.ts` (`schedules-assignment.spec.ts`, `payroll-close.spec.ts`).
- Casos: `"[ID] descripción"`, por ejemplo `[SCH-04] reemplaza Matutino por Vespertino`.
- Fixtures: `e2e-fixtures/<modulo>.ts`; datos con IDs estables y limpieza por tenant.
- Unit API: `<servicio>.test.ts`; unit web: `<hook|util>.test.ts` junto al archivo.





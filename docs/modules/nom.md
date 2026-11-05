# nom — Cumplimiento del registro electrónico de jornada (LFT 2027)

Módulo transversal de cumplimiento para el **registro electrónico de jornada** de la reforma a la LFT (art. 132, fracción XXXIV; obligatorio desde el 01-ene-2027). Implementa los requisitos técnicos F2-01..F2-04 del [PLAN_IMPLEMENTACION](../PLAN_IMPLEMENTACION.md) y es la evidencia técnica del checklist [NOM_CUMPLIMIENTO](../NOM_CUMPLIMIENTO.md).

> **Alcance legal:** este módulo implementa los requisitos *técnicos* (inmutabilidad, ajustes, auditoría, límites, retención, export). No certifica cumplimiento: el formato oficial de la STPS aún no se publica y la validación legal queda fuera del sistema (F2-06).

## Qué hace

- **Inmutabilidad de checadas (F2-01):** `time_clock_punches` es append-only por trigger de BD (sin UPDATE ni DELETE); `access_events` solo admite el primer pase a anulado. Las correcciones son registros de ajuste ligados, no ediciones.
- **Ajustes de checadas (F2-01/F2-02):** alta con motivo, valor anterior/nuevo y solicitante; aprobación/rechazo por un segundo usuario; historial y pista de auditoría por checada.
- **Límites legales de jornada (F2-03):** configurables por cliente **solo más estrictos que la ley** (12 h/día; jornada semanal 48/46/44/42/40 h de 2026 a 2030+), con barrido de alertas y aviso a RH (campanita + correo por la cola). La alerta semanal usa el umbral de infracción real: jornada ordinaria + extra al doble del año (9/9/10/11/12 h) + 4 h al triple; las horas extra legales ya no se marcan.
- **Retención y archivado (F2-04):** meses de retención por cliente; los registros vencidos se mueven a tablas `nom_archived_*` (no se pierden), con comando manual y worker diario.
- **Export formal del registro de jornada:** CSV/JSON por periodo y persona con hash SHA-256 de integridad (formato versionado `stps-registro-jornada-v0`).
- **Marcaje remoto (F2-07/F2-08):** inicio/fin de jornada desde la web/app para home office o campo, sin reloj, idempotente por `clientEventId`, con geolocalización OPCIONAL y solo en el instante del marcaje (sin rastreo continuo). Interruptor por cliente (`remotePunchEnabled`).
- **NOM-037 teletrabajo:** registro de teletrabajadores por cliente, política de teletrabajo/desconexión y aviso de privacidad editables con versiones y consentimiento del trabajador, checklist inicial/periódico del lugar de trabajo y registro de comunicaciones fuera de jornada (con aviso in-app al trabajador).
- **Flujo del trabajador:** consulta de sus propios marcajes (reloj + eventos de acceso + remotos), reporte de discrepancias (que entra al flujo de aprobación de ajustes) y portal propio (marcar, teletrabajo, checklist).

## Endpoints

| Grupo | Rutas |
|---|---|
| Config del cliente | `GET /config`, `PUT /config` (límites y retención; auditado) |
| Ajustes | `GET /punches/:punchId/history`, `POST /punches/:punchId/adjustments`, `GET /adjustments`, `POST /adjustments/:id/approve`, `POST /adjustments/:id/reject` |
| Alertas | `GET /alerts`, `POST /alerts/scan` |
| Retención | `GET /retention`, `POST /retention/archive` (`dryRun` opcional) |
| Export | `GET /export/stps?period=MONTH&date=YYYY-MM-DD&format=csv\|json` |
| Autoservicio | `GET /me/punches`, `POST /me/punch` (marcaje remoto), `GET /me/discrepancies`, `POST /me/discrepancies`, `GET /me/telework`, `POST /me/telework/accept`, `POST /me/telework/checklist` (solo sesión) |
| Teletrabajo (NOM-037) | `GET/PUT /telework/policy`, `GET/POST /telework/registrations`, `PATCH /telework/registrations/:id`, `GET /telework/checklists`, `GET/POST /telework/out-of-hours-contacts` |

Permisos: lectura con `time_clock.view` (el export también con `payroll.view`), escritura con `time_clock.write`. Las rutas `/me/*` solo exigen `authenticate` (el trabajador no necesita permisos de RH).

## Modelos

- `PunchAdjustment` (`punch_adjustments`): `punchId`, `requestedById`, `reason`, `previousState`/`newState` (JSON con el valor anterior/nuevo), `status` (`PENDING`/`APPROVED`/`REJECTED`), aprobador (`decidedById`), fechas y nota de decisión.
- `NomSettings` (`nom_settings`): por cliente (`tenantId` PK), `workdayLimitMinutes`, `weeklyLimitMinutes`, `retentionMonths` (null = default legal / sin archivado).
- `WorkdayLimitAlert` (`workday_limit_alerts`): alerta única por persona/escala/día con minutos trabajados, límite y contadores de aviso.
- `RemotePunch` (`remote_punches`): marcaje remoto append-only (trigger), hora del servidor, modalidad, geolocalización opcional, `clientEventId` idempotente. Se archiva por retención como las checadas.
- `TeleworkRegistration` (`telework_registrations`): una persona teletrabajadora por cliente (modalidad, domicilio opcional, estado, consentimiento versionado).
- `TeleworkChecklist` (`telework_checklists`): checklist inicial/periódico del lugar (respuestas JSON validadas contra la plantilla del API).
- `OutOfHoursContact` (`out_of_hours_contacts`): comunicación fuera de jornada (marca + aviso al trabajador).
- Tablas de archivo (sin modelo Prisma, SQL): `nom_archived_time_clock_punches`, `nom_archived_access_events` (mismas columnas + `archivedAt`).

## Inmutabilidad: cómo se garantiza

- Trigger `time_clock_punches_append_only` (BEFORE UPDATE OR DELETE) → `RAISE EXCEPTION`. La única excepción es un DELETE dentro de una transacción con `SET LOCAL app.nom_purge = 'on'`, que solo usa el archivado por retención.
- Trigger `access_events_append_only`: prohíbe DELETE y permite únicamente el primer UPDATE de anulación (`voidedAt` de NULL a fecha), sin cambios en ninguna otra columna.
- `PunchAdjustment` nunca modifica la fila original: el **valor vigente** se calcula al vuelo en `GET /punches/:id/history` aplicando los ajustes `APPROVED` en orden. No se puede decidir dos veces ni aprobar el propio ajuste (`SELF_APPROVAL_FORBIDDEN`).
- Toda solicitud/decisión escribe en `audit_logs` con `entityType: "TimeClockPunch"` y `entityId` de la checada (el histórico completo se consulta por `GET /audit?entityType=TimeClockPunch&entityId=...` o dentro del historial de la checada).

## Límites y alertas (F2-03)

- Precedencia: `nom_settings` del cliente → `sys_config` (`NOM_WORKDAY_LIMIT_MINUTES`, `NOM_WEEKLY_LIMIT_MINUTES`, `NOM_RETENTION_MONTHS`) → default legal calculado.
- Default legal diario: 720 min (12 h ordinaria + extra). Semanal por año: 2880 min (48 h, 2026), 2760 (46 h, 2027), 2640 (44 h, 2028), 2520 (42 h, 2029), 2400 (40 h, 2030+). Extra al doble: 540/540/600/660/720 min (9/9/10/11/12 h). Excedente al triple: 240 min. Máximo 4 h de extra por día y 4 días con extra por semana.
- El barrido usa el mismo cálculo diario de `schedules` que el reporte de horas extra (`computeOvertimeDays`): no duplica la lógica de emparejamiento del reloj.
- Al detectar un exceso: `WorkdayLimitAlert` (idempotente por persona/escala/día) + notificación in-app a `CLIENT_ADMIN`/`HUMAN_RESOURCES` del cliente + correo por la cola de `email_logs` + entrada de auditoría `WORKDAY_LIMIT_ALERT`.
- Worker: barrido horario (día anterior) y archivado diario; se arranca en `src/index.ts` (`startNomWorker`) y no corre en `NODE_ENV=test`. Para una corrida manual, `POST /alerts/scan`.

## Retención y archivado (F2-04)

- Solo actúa sobre clientes con `retentionMonths` configurado en `nom_settings`; el valor global `sys_config.NOM_RETENTION_MONTHS` sirve de default.
- `POST /retention/archive` (con `dryRun` para previsualizar) y worker diario mueven `time_clock_punches` y `access_events` con `occurredAt < corte` a las tablas de archivo en una transacción todo-o-nada (el conteo insertado debe coincidir con el borrado).
- Comando manual (desde `api/`):
  ```
  node --require ts-node/register/transpile-only --require tsconfig-paths/register scripts/nom-archive.ts --dry-run
  node --require ts-node/register/transpile-only --require tsconfig-paths/register scripts/nom-archive.ts
  ```
- El corte y el resultado quedan en `audit_logs` (`NOM_RETENTION_ARCHIVED`). La retención concreta (p. ej. ≥ 5 años) debe validarse legalmente: la disposición de la STPS aún no se publica.

## Export formal

`GET /export/stps` devuelve, por periodo (`DAY`/`WEEK`/`FORTNIGHT`/`MONTH`) y persona: día, número de empleado, nombre, departamento, horario, turno, minutos trabajados/programados/extra, descanso, sin horario y última salida. Incluye metadatos (cliente, periodo, zona horaria, totales, `generatedAt`, `sha256` del contenido). **El layout no es el oficial de la STPS**: está versionado y se ajustará cuando se publique la disposición (F2-06).

## Marcaje remoto (F2-07)

- `POST /nom/me/punch` con `{ type: "ENTRY"|"EXIT", workMode?, clientEventId?, latitude?, longitude?, gpsAccuracyMeters?, note? }`. La **hora es la del servidor** (`occurredAt`); `clientReportedAt` solo guarda lo que reportó el dispositivo (reintentos offline).
- **Idempotencia**: el mismo `clientEventId` devuelve el marcaje ya creado (`200`, `created: false`) en vez de duplicarlo.
- **Secuencia**: no se acepta un segundo ENTRY (o EXIT) consecutivo sobre el último marcaje remoto del trabajador (`409 INVALID_PUNCH_SEQUENCE`); se corrige reportando discrepancia a RH.
- **Geolocalización**: opcional; si se envía, van latitud y longitud juntas (`400 INVALID_GEO_POINT`) y se guardan **solo en ese marcaje**. No hay rastreo continuo: el API no consulta la ubicación en ningún otro momento.
- El registro es append-only por trigger; los marcajes remotos aparecen en `GET /nom/me/punches`, en el export STPS (sección “marcajes remotos”, sin coordenadas) y se archivan por retención.
- Interruptor por cliente: `PUT /nom/config { remotePunchEnabled: false }` → `403 REMOTE_PUNCH_DISABLED`.

## NOM-037 teletrabajo (F2-08)

- **Registro**: alta por RH (`POST /nom/telework/registrations`) con modalidad (REMOTO/HIBRIDO/CAMPO), domicilio opcional y estado; una persona por cliente (alta duplicada → `409`). Baja/terminación con `PATCH ... { status: "ENDED" }` (reactivable).
- **Política y aviso de privacidad por cliente**: `GET/PUT /nom/telework/policy` guarda `teleworkPolicy`, `disconnectPolicy` y `privacyNotice`; cada texto cambiado incrementa su versión (`policyVersion` / `privacyNoticeVersion`). El texto es editable: la validación legal queda fuera del sistema.
- **Consentimiento versionado**: `GET /nom/me/telework` muestra al trabajador su registro, política, aviso, plantilla del checklist y si falta aceptar. `POST /nom/me/telework/accept` acepta las versiones vigentes (versión vieja → `409 TELEWORK_POLICY_VERSION_CHANGED`).
- **Checklist del lugar de trabajo**: `POST /nom/me/telework/checklist` con `answers` (`YES`/`NO` para los 8 puntos de la plantilla; faltante → `400 TELEWORK_CHECKLIST_INCOMPLETE`). Inicial al alta, periódico cada 12 meses (`nextPeriodicDueAt`); el trabajador lo puede enviar como `PERIODIC`.
- **Comunicaciones fuera de jornada**: `POST /nom/telework/out-of-hours-contacts` registra el contacto (medio, motivo, fecha) y envía aviso in-app al trabajador (`OUT_OF_HOURS_CONTACT`); queda auditado. Es el control mínimo de desconexión: marcar y avisar.
- Portal del trabajador en la web: `/mi-jornada` (marcar, marcajes, discrepancia y teletrabajo propio); administración NOM-037 en `/teletrabajo` (política, altas, checklists y contactos).

## Dependencias

- `schedules`: cálculo diario de jornada/horas extra (puerto `computeOvertimeDays`).
- `notifications` / `email-queue`: avisos a RH (campanita y correo).
- `audit`: pista de auditoría de ajustes, configuración, alertas y archivado.
- `core/utils/timezone`: zonas y rangos locales por cliente.

## Notas multi-tenant

- `PunchAdjustment`, `NomSettings` y `WorkdayLimitAlert` están en `TENANT_MODELS`, con `tenantId` por contexto y RLS si `RLS_ENABLED=true`.
- El archivado filtra explícitamente por `tenantId` en SQL crudo (no depende de la extensión).
- Un usuario de un cliente no puede ver ni ajustar checadas de otro (`404 PUNCH_NOT_FOUND`).
- El personal de plataforma solo archiva un cliente distinto al del contexto si es usuario de plataforma (sin `tenantId`).

## Pendientes (no automatizables o de validación)

- Formato oficial de la disposición STPS (F2-06) y retención legal definitiva.
- Marcaje remoto por app/web (home office/campo) — requisito 1 del checklist; hoy solo reloj y módulo access.
- NOM-037 (teletrabajo): registro de teletrabajadores, política de desconexión y checklist del lugar de trabajo.
- Pantalla web del historial de ajustes de checada para RH (el trabajador ya tiene portal en `/mi-jornada`).
- Las correcciones de un **marcaje remoto** aún no tienen ajuste ligado (el ajuste referencia checadas del reloj): por ahora el trabajador reporta la discrepancia a RH y el registro remoto es inmutable; evaluar `PunchAdjustment` polimórfico o tabla de ajuste remoto.

## Portal del trabajador (UX)

- `/#/mi-jornada` es **solo para sesiones de cliente** (guarda `TenantOnly`); el personal de plataforma no lo ve en el menú y la ruta lo regresa a su inicio. En modo rutas por cliente vive en `/#/<slug>/mi-jornada`.
- El portal es responsive: resumen de entrada/salida en dos tarjetas, formularios y botones a ancho completo en móvil, listas y checklist que se apilan. El menú lateral usa un icono propio (`LuCalendarCheck`) para la pantalla.
- La hidratación de `/auth/me` no expulsa a un cliente de su ruta: los guards esperan a que la sesión tenga `tenant` y permisos antes de redirigir.

## Motor semanal de horas extra (F1)

- `src/modules/overtime/services/weekly-overtime-engine.ts`: función pura que clasifica la semana en **doble**, **triple** y **excedente ilegal** con la tabla legal 2026-2030 (jornada 48/46/44/42/40 h; extra al doble 9/9/10/11/12 h; 4 h/día, 4 días/semana, 4 h al triple, tope diario 12 h). Menores de 18 no hacen extra y se marca infracción; el excedente ilegal se contabiliza (se paga) y genera infracción.
- 18 casos de prueba del plan en `weekly-overtime-engine.test.ts` (más dos de guardia).
- `weekly_overtime_ledgers` (migración `20261112000000_weekly_overtime_ledger`): snapshot por persona/semana con detalle día por día, violaciones, versión del motor y estado DRAFT → CONFIRMED/CLOSED. RLS por cliente.
- Endpoints (permiso `time_clock.view` para leer, `time_clock.write` para recalcular/confirmar):
  - `GET /nom/overtime/weekly?date=YYYY-MM-DD` (calcula/recupera la semana),
  - `POST /nom/overtime/weekly/recalculate` (body `date`),
  - `POST /nom/overtime/weekly/:id/confirm` (congela el snapshot).
- **Tipo de turno (H-01):** `shiftTypeOf` en `schedules/services/workday-rules.ts` clasifica cada día como diurna/nocturna/mixta (art. 60) y viaja en el cálculo diario (`shiftType`); el motor semanal lo usa para el máximo diario de 7/7.5/8 h.
- **Festivos (H-05):** catálogo `holidays` por cliente con siembra automática de los obligatorios del art. 74 al consultar el año; `GET/POST/DELETE /nom/holidays`. El motor separa la bolsa `festivoLaborado` y no consume el tope de extra.
- **Export STPS v1:** `stps-registro-jornada-v1` incluye columnas `extraDoble`, `extraTriple`, `excedenteIlegal`, `descansoLaborado`, `festivoLaborado`, `domingo`, `menor` e `infracciones`, tomadas del ledger semanal; el export asegura el cálculo del ledger de las semanas del periodo.
- **UI de aprobación semanal:** panel «Horas extra por semana (LFT 2026)» en Tiempo extra; muestra ordinaria/doble/triple/excedente por persona y permite confirmar (congelar) el ledger si el usuario tiene `overtime.approve`.
- Pendiente de F1: bolsas en la pre-nómina (el export ya las incluye).

## Prueba plena del registro (F3, R-01)

- `work_record_agreements`: acuerdo del método de registro por trabajador (métodos CLOCK/REMOTE/ACCESS, política de redondeo y reglas de corrección), con versión del texto, fecha, IP y **hash SHA-256** de aceptación.
- `work_record_acknowledgments`: conformidad periódica; el trabajador ve el resumen de sus ledgers semanales (ordinaria, doble, triple, ilegal) y lo acepta o abre una discrepancia con nota. El resumen y su hash quedan guardados.
- Endpoints: `GET/POST /nom/me/record-agreement(/accept)`, `GET/POST /nom/me/record-acknowledgments` y listados de RH `GET /nom/record-agreements` y `GET /nom/record-acknowledgments` (permiso de lectura NOM).
- **Retención art. 804 (R-02, en curso):** el archivado nunca toca los últimos 12 meses de la relación laboral ni los registros de personas con baja reciente (piso legal de 12 meses); el export STPS lee las tablas `nom_archived_*` e incluye una sección de registros archivados.
- **UI en Mi jornada:** tarjeta «Mi registro de jornada» (aceptar método + confirmar semana o reportar discrepancia) y «Solicitudes de horas extra» (aceptar/rechazar desde el teléfono). La conformidad y el consentimiento quedan auditados con hash en el servidor.

## Autorización previa y consentimiento de horas extra (F3, 1.5)

- `overtime_requests` (migración `20261115000000_overtime_requests`): el patrón pide la extra con motivo, minutos y días; el trabajador **acepta o rechaza** desde `/me/overtime-requests/:id/decision`. El registro de lo trabajado no cambia por el rechazo.
- Menores de 18 no pueden recibir solicitudes (`MINOR_OVERTIME_FORBIDDEN`); el máximo por día es 4 h y no se puede decidir dos veces.
- Endpoints: `GET/POST /nom/overtime/requests`, `POST /nom/overtime/requests/:id/cancel` (RH) y `GET /nom/me/overtime-requests`, `POST /nom/me/overtime-requests/:id/decision` (trabajador).
- Pendiente F3: pantalla de RH para crear solicitudes y cierre de R-02 (export de archivos ya incluido; falta revisión final).

## Brechas NOM-037 (F4)

- **% de teletrabajo y datos del puesto** en `TeleworkRegistration` (porcentaje, actividades, puesto, lugares convenidos); alerta si baja de 40 % (art. 330-A).
- **Validación del checklist por la Comisión de Seguridad e Higiene**: `POST /nom/telework/checklists/:id/validate` con resultado APTO/NO_APTO, validador y fecha. Un **NO_APTO bloquea el marcaje remoto** (`TELEWORK_WORKPLACE_NOT_APPROVED`).
- **Equipo entregado** (`telework_equipment_deliveries`) con acuse del trabajador y hash; **capacitación anual** con vencimiento; **avisos escritos** del trabajador y **reversibilidad a presencial** con decisión auditada.
- Endpoints de RH y de autoservicio (`/nom/me/telework/...`); todo con RLS por cliente.
- Pendiente F4: política con secciones obligatorias (plantilla), retención de evidencias, desconexión del propio sistema (diferir notificaciones) y capacitación con alertas automáticas.

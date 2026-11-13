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

## Marcaje remoto (F2-07) — web y futura app

- Secuencia del día: **ENTRY → LUNCH_START → LUNCH_END → EXIT** (también ENTRY → EXIT directo). El mismo API (`POST /nom/me/punch`) sirve a la web actual y a la app; el canal siempre es el mismo registro `remote_punches` (campo `source`: `WEB`/`APP`), con hora del servidor e idempotencia por `clientEventId` (obligatorio, uuid).
- **Canal del cliente (`Tenant.punchChannels`)**: la web manda `WEB` (default) y la app `X-Punch-Source: APP`; si el cliente no contrató ese canal responde `403 PUNCH_CHANNEL_DISABLED`. El modo preferido del empleado (`User.checkinMode`) ya no bloquea el marcaje.
- La secuencia se reinicia cada día del cliente (zona horaria del tenant), aunque el día anterior haya quedado abierto. **Con mix de canales no aplica**: si hoy la persona ya tiene checadas del reloj (sus números de `TimeClockEmployee`), el API no exige secuencia remota —el reloj no dice entrada/salida y bloquearla dejaría el día sin cerrar— y solo valida canal, geolocalización, acuerdo y teletrabajo.
- Mi jornada (pestaña «Mi checada») muestra el **siguiente paso** resaltado, un botón directo de **Salida** cuando la comida es opcional (entrada → salida) y los cuatro movimientos con su hora; sin opciones por marcaje: la persona solo marca. Tras la salida muestra «jornada cerrada». Las checadas del reloj físico y los accesos aparecen en «Mis marcajes».

## Marcaje remoto (F2-07)

- `POST /nom/me/punch` con `{ type: "ENTRY"|"EXIT", workMode?, clientEventId, latitude?, longitude?, gpsAccuracyMeters?, note? }`. `clientEventId` es **obligatorio** (uuid); sin él la petición responde `400 VALIDATION_ERROR`. La **hora es la del servidor** (`occurredAt`); `clientReportedAt` solo guarda lo que reportó el dispositivo (reintentos offline).
- **Modalidad (`workMode`)**: no se le pregunta a la persona. Si la petición no la trae, el API toma la del **registro de teletrabajo activo** (`REMOTO`/`HIBRIDO`/`CAMPO`, alta por RH) y, sin registro, asienta `REMOTO`; una modalidad explícita (app móvil anterior) se respeta. La `note` sigue aceptándose en el API pero la web ya no la captura: las correcciones van por discrepancia.
- **Idempotencia**: el mismo `clientEventId` devuelve el marcaje ya creado (`200`, `created: false`) en vez de duplicarlo, aunque el reintento llegue después de cerrar el día. Es por persona: un `clientEventId` que ya usó otra cuenta responde `409 CLIENT_EVENT_ID_TAKEN` y nunca devuelve la checada ajena.
- **Concurrencia**: la secuencia y el alta corren en una transacción con `pg_advisory_xact_lock` por usuario; dos checadas simultáneas de la misma persona se serializan (la segunda ve el estado ya insertado) y no pueden leer el mismo estado anterior. Con dos ENTRY en paralelo, una responde `201` y la otra `409 INVALID_PUNCH_SEQUENCE`; con el mismo `clientEventId`, una `201` y la otra `200 created:false`.
- **Secuencia**: entrada → (salida a comer → regreso) → salida, un solo ciclo por día en la zona del cliente. La primera checada del día siempre es entrada. Un paso fuera de orden responde `409 INVALID_PUNCH_SEQUENCE`; tras la salida el día queda cerrado (`409 WORKDAY_ALREADY_CLOSED`). Al día siguiente la secuencia arranca de nuevo. Los errores se corrigen reportando discrepancia a RH. Excepción de mix: si hoy ya hay checadas del reloj del trabajador, la secuencia remota no se aplica (sí la idempotencia y las validaciones).
- **Origen en Mis marcajes**: cada fila trae `source` (grupo: `CLOCK`/`ACCESS`/`REMOTE`) y `channel` (origen real: `CLOCK`, `WEB`, `APP` o `null` en la bitácora de acceso), para que la web y la app muestren de dónde vino cada checada.
- **Geolocalización**: opcional; si se envía, van latitud y longitud juntas (`400 INVALID_GEO_POINT`) y se guardan **solo en ese marcaje**. No hay rastreo continuo: el API no consulta la ubicación en ningún otro momento. Se guardan **cifradas** en `remote_punches.location` (`sealLocation`/`openLocation` en `services/punch-location.ts`, AES-256-GCM); las columnas `latitude`/`longitude`/`gpsAccuracyMeters` solo conservan marcajes anteriores al cifrado y `scripts/nom-seal-locations.ts` las mueve a `location` (el trigger append-only admite únicamente ese cambio bajo `app.nom_location_seal`).
- El registro es append-only por trigger; los marcajes remotos aparecen en `GET /nom/me/punches`, en el export STPS (sección “marcajes remotos”, sin coordenadas) y se archivan por retención.
- Interruptor por cliente: `PUT /nom/config { remotePunchEnabled: false }` → `403 REMOTE_PUNCH_DISABLED`.

## Reglas de QA (2026-11-08)

Corregidas tras la corrida de los bots de QA (`api/qa/`):

- **Config NOM**: el primer guardado aplica todos los campos (antes el alta ignoraba `blockRemoteWithoutAgreement`, `remoteCountsForWorkday` y `requireUnionForCollective`), y `weekStartDay` se guarda solo si toda la petición pasó la validación.
- **Convenios de distribución**: la persona y el horario deben ser del cliente (`404`); solo acepta la persona del convenio individual o quien tiene asignado el horario del colectivo.
- **Acuerdo de método**: una versión nueva (métodos o reglas distintos) borra la firma patronal de la anterior; firmar dos veces la misma versión → `409 AGREEMENT_ALREADY_SIGNED_BY_EMPLOYER`.
- **Checklist de teletrabajo**: la validación solo acepta `APTO` o `NO_APTO` (`400 INVALID_CHECKLIST_RESULT`).
- **Constancia semanal**: firma solo con `accept` ausente o `true`; otro valor → `400 INVALID_ACK_ACCEPT`. Una objeción no guarda `acceptedAt`.
- **Export STPS**: cada descarga queda en bitácora (`STPS_EXPORT_DOWNLOADED`, periodo, formato y hash).
- **Historial de una checada remota**: trae su pista de auditoría; `GET /nom/me/punches` muestra la hora vigente (con ajustes aprobados).
- **Vacaciones y permisos**: los festivos del catálogo no cuentan como días; no se pide más de lo disponible menos lo pendiente, y al aprobar se revisa otra vez el saldo; las vacaciones se ganan al cumplir el primer año (`400 VACATION_NOT_YET_EARNED`); cada solicitud cuenta en el año en que empieza; nadie decide su propia solicitud (`403 LEAVE_SELF_DECISION`); solo la incapacidad se registra hacia atrás (`400 LEAVE_IN_PAST`). Pedir avisa a administración y RH; decidir avisa al trabajador.
- **Tiempo extra**: la autorización previa no acepta días pasados (`400 OVERTIME_DAY_IN_PAST`); el ledger semanal respeta el convenio del art. 58.

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
- **Comida configurable por cliente:** `nom_settings.lunchPunchEnabled` (default `true`, migración `20261212000000_lunch_punch_setting`), editable en Configuración del sistema → «Comida en la checada web» y en la app (`PUT /nom/config`). Apagada, la secuencia es entrada → salida: `LUNCH_START` responde `409 INVALID_PUNCH_SEQUENCE`, y quien ya había salido a comer puede regresar o salir. `GET /nom/me/telework` expone `lunchPunchEnabled` y la web y la app ocultan los pasos y tarjetas de comida.
- **Quién puede checar por web/app:** `GET /nom/me/telework` expone `punchChannels` (mix del cliente), `canPunchWeb`, `canPunchApp` y `canPunchRemote` (algún canal remoto habilitado y `remotePunchEnabled`). Ya no depende de `checkinMode` de la persona. Si no hay canal remoto, Mi jornada (web y app) muestra «Checas en el reloj» en lugar del botón; los marcajes y el reporte de discrepancia siguen disponibles.
- **Candado del acuerdo de método:** `GET /nom/me/telework` expone `remoteAgreementRequired` (`nom_settings.blockRemoteWithoutAgreement`). Si es `true` y la persona no ha aceptado un acuerdo que incluya `REMOTE`, Mi jornada (web) muestra el acuerdo dentro de la tarjeta de checada con un solo botón «Acepto y registro mi entrada» (acepta y checa en un clic); el API sigue respondiendo `403 REMOTE_AGREEMENT_REQUIRED` como respaldo.
- **Correcciones de checadas (RH, web):** `features/nom/punch-corrections` en `/hr/jornada-acuerdos`: lista `GET /nom/adjustments`, decide con `POST /nom/adjustments/:id/approve|reject` y muestra `GET /nom/punches/:id/history`. En Mi jornada el reporte acepta la hora correcta (`expectedOccurredAt`, armada en la zona del cliente).
- **Zona del cliente en Mi jornada:** el día, las horas y el rango de marcajes se calculan con `tenant.timezone`, no con la zona del navegador.
- **Sello encadenado del export:** modelo `NomExportSeal` (`nom_export_seals`, solo inserción); `StpsExportService.sealExport` sella bajo candado por cliente y `GET /nom/export/seals` verifica la cadena.
- **Datos sensibles:** `TeleworkRegistration.homeAddress` se guarda cifrado (`sealText`/`openText` en `core/utils/crypto`); valores anteriores en claro se siguen leyendo.
- **Políticas NOM-037 adicionales:** `nom_settings.equipmentPolicy` y `returnToOfficePolicy`, en `PUT /nom/telework/policy`; cambiar cualquiera sube `policyVersion`.
- **Candado en la app móvil:** `GET /nom/me/telework` expone también `remoteAgreementPending` (lo exige el cliente y la persona no ha aceptado). La app muestra el acuerdo en el panel de checada con un botón que acepta y registra en un toque.
- **Confirmaciones del portal:** aceptar acuerdos, confirmar la semana, decidir horas extra, reportar una discrepancia, enviar el checklist y pedir o cancelar un permiso muestran un aviso de éxito (`usePortalToast`, textos en `nom:done`).
- **Ledger semanal:** `WeeklyOvertimeService.refreshWeek` recalcula los borradores de la semana con una sola lectura de los existentes y escrituras en paralelo; el export STPS semanal le pasa el cálculo diario que ya hizo en lugar de repetirlo.
- **Checada ágil (web):** `POST /nom/me/punch` hace sus lecturas previas (canales, configuración, acuerdo, registro de teletrabajo y última validación) en un solo `Promise.all`. La web pinta la checada con la respuesta del API y reconcilia la lista en segundo plano; el botón muestra la etapa («Obteniendo tu ubicación…», «Registrando…») con una franja de avance. La ubicación se pide al marcar con `maximumAge` de 60 s y espera máxima de 4 s; si no llega, la checada se registra sin ubicación. La tarjeta vive en `features/nom/worker-portal/ui/PunchCard.tsx`.
- **Ubicación opcional por cliente:** `nom_settings.remoteGeolocationEnabled` (default `true`), editable en Configuración del sistema → «Ubicación en la checada web» (`PUT /nom/config`). Encendida, la web la toma sola al marcar (sin casilla por marcaje; el navegador pide su permiso y, si se niega, la checada se registra sin ubicación) y avisa que se guarda; apagada, el portal no la pide ni muestra el mapa (`GET /nom/me/telework` expone el valor) y el API descarta las coordenadas aunque el dispositivo las mande; las ya guardadas no se borran.
- **Mis marcajes (Mi jornada):** lista agrupada por día con el tipo real de cada checada (entrada, salida a comer, regreso, salida) y «Reportar» abre el motivo junto a la fila.
- **Pantalla de RH «Acuerdos con el personal»** (`/hr/jornada-acuerdos`), dos pestañas: **Jornada acordada** (convenio de distribución art. 58: persona, vigencia, texto de lo acordado y casilla «con sindicato») y **Forma de registro** (acuerdos de método aceptados por el personal; RH firma uno o todos los pendientes). El trabajador acepta ambos desde avisos al inicio de Mi jornada: `GET /nom/me/distribution-agreements` lista los convenios que le tocan (propios o de sus horarios) y `POST /nom/me/distribution-agreements/:id/accept` los acepta. Sin aceptación el motor no reconoce el convenio.
- Endpoints: `GET/POST /nom/me/record-agreement(/accept)`, `GET/POST /nom/me/record-acknowledgments` y listados de RH `GET /nom/record-agreements` y `GET /nom/record-acknowledgments` (permiso de lectura NOM).
- **Retención art. 804 (R-02, en curso):** el archivado nunca toca los últimos 12 meses de la relación laboral ni los registros de personas con baja reciente (piso legal de 12 meses); el export STPS lee las tablas `nom_archived_*` e incluye una sección de registros archivados.
- **Pestañas de Mi jornada (simplificadas):** «Teletrabajo» solo aparece con registro activo; sus tres textos (política, desconexión, aviso) van plegados y el checklist solo se pide cuando toca (`nextPeriodicDueAt`), con «Volver a llenar» si la persona quiere. «Registro y horas extra» muestra el estado del acuerdo sin repetir su texto, la conformidad de la semana como dos botones («Sí, todo correcto» / «Algo no coincide», que abre la nota) y deja de pedirla si ya se respondió esa semana; la tarjeta de horas extra solo aparece si hay solicitudes. Las pestañas llevan contador de pendientes.
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
- **Política con secciones obligatorias (5.2):** `PUT /nom/telework/policy` rechaza 400 `TELEWORK_POLICY_SECTIONS_MISSING` si falta horario, desconexión, riesgos, equipo, lactancia o reversibilidad; `GET /nom/telework/policy/template` entrega la plantilla base.
- **Expediente NOM-037 exportable (10.4):** `GET /nom/telework/evidence` devuelve políticas, registros, checklists, equipo, capacitación, avisos, reversibilidad y hash SHA-256 para conservarlo como evidencia.
- **Alertas de capacitación:** `GET /nom/telework/trainings/expiring?days=30` lista las que vencen en la ventana.
- **Desconexión del propio sistema (4.11/7.3 e):** las notificaciones a un teletrabajador activo se **difieren a su siguiente jornada** si llegan fuera de su horario (`notifications.deferredUntil`); no aparecen en la campanita ni cuentan como no leídas hasta entonces. Cubre también turnos que cruzan medianoche.
- Pendiente F4: retención mínima de 1 año de evidencias y P1/P2 (riesgos ergonómicos, exámenes médicos, violencia familiar, dictámenes).

## P2 del teletrabajo (F6)

- **Exámenes médicos** (`telework_medical_exams`): inicial/periódico, fecha de realización, vencimiento, resultado, evidencia. Endpoints `GET/POST /nom/telework/medical-exams`.
- **Dictámenes de unidad de inspección** (`inspection_certificates`): emisor, número único por cliente, vigencia y evidencia. Endpoints `GET/POST /nom/telework/inspections`, con validación de duplicados.
- Ambos entran al **expediente NOM-037** (`/nom/telework/evidence`).
- Pendiente F6: canal confidencial de violencia familiar (requiere decisión legal/privacidad) y retención mínima de 1 año de evidencias.

## Política de asistencia por cliente

- `NomSettings` guarda defaults para horarios nuevos: tolerancia de entrada/salida, comida y mínimo de tiempo extra (`defaultEntryToleranceMin`, `defaultExitToleranceMin`, `defaultMealBreakMin`, `defaultMinOvertimeMin`).
- `POST /schedules` los aplica cuando el alta no especifica el valor; se editan en **Configuración del cliente** junto a la semana laboral.
- Los horarios siguen pudiendo sobrescribir cada valor individualmente.

## Vacaciones y permisos (configurable)

- `leave_types` por cliente (VACACIONES, PERMISO_PAGADO, PERMISO_SIN_GOCE, INCAPACIDAD + los que agregue RH) con `kind` y `paid`.
- `leave_requests` con rango, días, motivo, estado y aprobador.
- Saldo devengado LFT art. 76: 12 días el primer año, +2 por año hasta 20 y +2 por cada 5 años; descuenta vacaciones aprobadas y pendientes.
- Endpoints: `/nom/me/leave/balance|requests` (trabajador, con `/cancel`), `/nom/leave/types` (GET/POST/PATCH/DELETE, baja lógica con `includeInactive`) y `/nom/leave/requests` con decisión de RH.
- UI: tarjeta de vacaciones en **Mi jornada**, pantalla **RH → Vacaciones** para aprobar/rechazar y **Configuración → Catálogos** para administrar tipos de permiso (alta, edición y baja lógica).
- Validaciones: rango, solape entre solicitudes, días hábiles y saldo suficiente para vacaciones.

## Orden de los listados

- Convención de tablas con fecha: el orden por defecto es **lo más reciente primero**; la fecha manda sobre el estado. Aplica a `GET /nom/leave/requests` (`startDate desc`), `GET /nom/overtime/requests` (`createdAt desc`) y `GET /nom/telework/registrations` (`startedAt desc`), que antes agrupaban por `status`.
- Los catálogos sin fecha (tipos de permiso, consentimientos) y el catálogo de festivos por año (`GET /nom/holidays`, cronológico del año) conservan su orden.
- Las trazas que son parte del cálculo o de la evidencia (historial de ajustes de una checada, expediente NOM-037 exportable) se quedan en ascendente: ahí el orden no es de presentación.

## Evidencia consistente (Fase 1 del plan de cierre de huecos)

- **RJ-03:** `core/utils/adjusted-punches.ts` materializa la hora vigente de una checada aplicando sus ajustes APPROVED en orden. El reporte de reloj (y todo lo que depende de él: asistencia, prenómina, ledger, export) lee esa hora; la checada original sigue inmutable.
- **RJ-02:** el reporte de reloj mezcla `time_clock_punches` y `remote_punches` en UNA línea de tiempo por persona y día: las checadas del reloj (sin tipo) hacen toggle entrada/salida con tope de 13 h y los marcajes web/app usan su tipo (ENTRY/LUNCH_END abren; LUNCH_START/EXIT cierran). Los eventos repetidos a < 5 min se descartan cuando participa el reloj. Cada sesión expone su `source` (`CLOCK`/`WEB`/`APP`/`MIXED`). `nom_settings.remoteCountsForWorkday = false` es el único opt-out (no se lee `remote_punches`). Ya no se emite `REMOTE_CONFLICT`.
- **RJ-04:** `punch_adjustments` guarda `targetType` (CLOCK/REMOTE/ACCESS) y `targetId`; las discrepancias de Mi jornada aplican a marcajes remotos y el reporte usa la hora/tipo corregidos. La checada original permanece inmutable.
- **RJ-06:** export `stps-registro-jornada-v2` con `primeraEntrada`, `ultimaSalida` y `origen` por día, sección de detalle de marcajes (reloj vigente, remoto y archivo), `minor` desde el ledger y SHA-256 calculado sobre el texto final entregado.

## Decisiones legales configurables (D-1/D-3/D-4)

`nom_settings` expone `blockRemoteWithoutAgreement` (default true: sin acuerdo de método con
REMOTE no hay checada web), `requireUnionForCollective` (default true: convenio colectivo se firma
con el sindicato) y `remoteCountsForWorkday`. Se editan en **Configuración del cliente**.
La UI RH `/hr/jornada-acuerdos` da de alta convenios art. 58, muestra su aceptación y permite la
firma patronal de los acuerdos de método; el botón de archivado de retención vive en Configuración.

## Checada multicanal (reloj, web, app)

- **Canales por cliente**: la plataforma contrata el mix en `Tenant.punchChannels` (`WEB`, `APP`, `CLOCK`); `/auth/me` y `GET /nom/me/telework` lo exponen. Un cliente puede tener solo reloj, solo web/app o mezcla, y el mix puede cambiar con el tiempo.
- **Reloj físico**: `time_clock_punches` (ISAPI), inmutable y sincronizado por el agente; la checada no trae tipo.
- **Web**: `remote_punches` vía `POST /nom/me/punch`, canal `WEB` (o `X-Punch-Source: APP` desde la app), con secuencia entrada/comida/regreso/salida.
- **App**: reutiliza el mismo endpoint y tipos de checada; solo manda el header del canal y su `clientEventId`.
- **Mezcla**: el reporte de reloj arma un solo timeline por persona y día (checadas del reloj como toggle, marcajes web/app por tipo, dedupe de duplicados a < 5 min cuando participa el reloj). La sesión lleva `source` `CLOCK`/`WEB`/`APP`/`MIXED`.
- Todas las fuentes se muestran juntas en Mi jornada y en el reporte de asistencia; asistencia semanal, pre-nómina y horas extra leen ese mismo reporte (sin volver a leer `remote_punches`).

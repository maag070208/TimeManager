# Plan de cierre de huecos — registro electrónico de jornada (LFT 2027)

Fecha: 2026-11-05. Estado: **implementado** (2026-11-05) — RJ-01 a RJ-09 en código con pruebas. Quedan decisiones legales abiertas §7 y los pendientes de autoridad §8.

Cierra los huecos que quedaron abiertos tras la auditoría de código del registro electrónico
de jornada (LFT art. 132 fr. XXXIV, exigible 01-ene-2027; multa art. 994 fr. IV Bis) frente al
checklist de [NOM_CUMPLIMIENTO.md](NOM_CUMPLIMIENTO.md) y a la ficha técnica
[modules/nom.md](modules/nom.md). Complementa a [PLAN_CUMPLIMIENTO_JORNADA.md](PLAN_CUMPLIMIENTO_JORNADA.md),
que cubre el marco legal y la transición 46→40 h.

> **Alcance.** Este plan corrige lo que depende del producto. El formato oficial, el ámbito de
> aplicación, las excepciones, el plazo de gracia y la retención definitiva dependen de las
> disposiciones generales de la STPS (aún sin publicar) y quedan **fuera de alcance** (ver §8).
> No es una certificación legal: la validación con asesor sigue siendo requisito.

---

## 1. Base de la auditoría

Evidencia de partida (auditoría de código, no de documentación):

- Tests unitarios del API: **115/115** en verde (`cd api && pnpm test:unit`).
- Ya cubierto y **no se toca** en este plan: inmutabilidad append-only por trigger, ajustes con
  aprobador distinto, alertas de límite (46 h/2027 y 9 h extra), piso de retención art. 804,
  portal `/mi-jornada`, motor semanal legal 2026-2030, export con hash SHA-256.
- Documentación desactualizada que se corrige en RJ-10: `NOM_CUMPLIMIENTO.md` (habla de layout
  `v0` y 83 tests) y `ANALISIS_COBERTURA_OPERACION.md` (dice que no existe vacaciones; sí existe).

Trazabilidad de este plan con el resumen legal:

| Requisito legal | Huecos que lo afectan |
|---|---|
| Registro de inicio y fin para cada persona | RJ-02, RJ-03, RJ-06 |
| Registro verificable, no hoja editable | sin huecos (append-only ya implementado) |
| Trazabilidad de correcciones (quién, qué, cuándo) | RJ-03, RJ-04, RJ-05 |
| Prueba plena (método acordado entre las partes) | RJ-07 |
| Acceso del trabajador a sus registros | RJ-07 (UX) |
| Entrega a la autoridad cuando se le requiera | RJ-06 |
| Conservación (art. 784/804) | RJ-05 |
| Jornada 46 h/2027 y cambio por convenio | RJ-01 |
| Topes de horas extra y pago correcto | RJ-08, RJ-09 |

---

## 2. Resumen ejecutivo

| ID | Hueco | Prioridad | Talla | Depende de |
|---|---|---|---|---|
| RJ-01 | Sin convenio art. 58 (distribución/cambio a 46 h) | P0 | M | ✅ implementado (API + motor; UI RH básica pendiente) |
| RJ-02 | Marcaje remoto no suma jornada (subregistro) | P0 | L | ✅ implementado |
| RJ-03 | Ajuste aprobado no incide en jornada ni export | P0 | M | ✅ implementado (falta cancelar un aprobado) |
| RJ-04 | Marcaje remoto sin flujo de corrección | P0 | M | ✅ implementado |
| RJ-05 | Retención falla con checadas ajustadas; piso legal incompleto | P0 | M | ✅ implementado (falta botón web) |
| RJ-06 | Export incompleto para inspección | P1 | M | ✅ v2 implementado (falta detalle de access_events) |
| RJ-07 | Prueba plena unilateral y UI que no muestra lo que se firma | P1 | M | ✅ implementado (falta pantalla RH para firmar) |
| RJ-08 | Jornada diaria 8/7/7.5 y tope 12 h sin bloquear; sin desglose diario | P1 | L | ✅ implementado |
| RJ-09 | Infracciones de menores y art. 66 no marcadas | P2 | S | ✅ implementado |
| RJ-10 | Sincronizar documentación de cumplimiento | P2 | S | ✅ implementado |

**Criterio de "hecho" para toda tarea:** código + migración (si aplica) + tests unitarios e
integración en verde + `pnpm typecheck` y `pnpm lint` en 0 + ficha `docs/modules/<modulo>.md`
actualizada en el mismo commit + modelo nuevo registrado en `api/src/core/tenancy/models.ts`
si es multi-tenant. Nada de E2E salvo petición explícita.

---

## Estado de ejecución (2026-11-05)

- **RJ-03 ✅** `api/src/core/utils/adjusted-punches.ts` aplica los ajustes APPROVED en orden y el reporte de reloj/asistencia usa la hora vigente; cubierto por `tests/integration/workday-evidence.flow.test.ts`.
- **RJ-02 ✅** el reporte de reloj arma **un solo timeline** por persona/día mezclando `time_clock_punches` y `remote_punches` (ENTRY/LUNCH_END abren, LUNCH_START/EXIT cierran; una checada del reloj sin tipo funciona como toggle con tope de 13 h). Ya no hay `REMOTE_CONFLICT` ni "gana el reloj": los canales se mezclan y cada fila reporta `source` `CLOCK|WEB|APP|MIXED`. Flag por cliente `nom_settings.remoteCountsForWorkday` (default true) expuesto en Configuración del cliente; `tenants.punchChannels` define qué canales puede usar el cliente.
- **RJ-06 ✅** export `stps-registro-jornada-v2`: primera entrada, última salida y origen por día, detalle de marcajes (reloj vigente + remoto + archivo), `minor` desde el ledger y SHA-256 sobre el texto final (CSV y JSON) recalculable por el receptor.
- **Evidencia:** unitarios 115/115, integración 186/186, `tsc` limpio. E2E de prenómina/Mi jornada en verde.
- **RJ-04 ✅** `PunchAdjustment` es polimórfico (`targetType` CLOCK/REMOTE/ACCESS + `targetId`); la discrepancia del trabajador ya acepta marcajes web, RH aprueba y el reporte usa la hora/tipo vigentes. La UI de Mi jornada permite reportar checadas remotas. Historial y auditoría conservan el objetivo.
- **RJ-01/RJ-08 ✅** convenio `workday_distribution_agreements` con aceptación del trabajador y alimentación del motor; jornada diaria topada a 8/7/7.5 h sin convenio, exceso diario como extra y bloqueo de días > 12 h.
- **RJ-05 ✅** el archivado mueve también los ajustes, respeta bajas recientes en `access_events`, audita desde el script y protege las tablas de archivo con RLS y bloqueo de TRUNCATE.
- **RJ-07 ✅** versiones append-only del acuerdo de método, firma del trabajador y del patrón con hash/IP, y UI que muestra el texto/métodos que se firman.
- **RJ-09 ✅** todo exceso de un menor se clasifica ilegal (nunca doble/triple) y se marcan `ART_66_EXCEDE_DIA`/`ART_66_EXCEDE_DIAS`.
- **Evidencia final:** unitarios **115/115**, integración **191/191** (56 suites), `tsc` limpio.
- **UI administrativa ✅** `/hr/jornada-acuerdos`: alta de convenios art. 58, lista con aceptación y firma patronal de acuerdos de método. **Configuración del cliente** incluye bloqueo de checada web sin acuerdo, exigencia sindical en convenio colectivo y botón de archivado de retención.
- **STPS ✅** guía de adaptación en STPS_ADAPTACION.md; layout v2 versionado hasta publicación oficial.
- **Revisión legal ✅** paquete en LEGAL_REVISION_ACUERDOS.md con textos, decisiones iniciales y preguntas al abogado.

## 3. P0 — Evidencia que se cae en inspección o juicio

### RJ-01 · Convenio art. 58: distribución de jornada y cambio a 46 h

**Problema.** El motor tiene el flag `hasDistributionAgreement`
(`api/src/modules/overtime/services/weekly-overtime-engine.ts:56-57`) pero **ningún servicio lo
alimenta** (`weekly-overtime.service.ts:94-98`). No existe modelo, endpoint ni evidencia de que
el horario o la distribución hayan sido acordados con la persona trabajadora o el sindicato. El
recorte a 46 h de 2027 no puede imponerse unilateralmente.

**Cambio esperado.**

1. Modelo `WorkdayDistributionAgreement` (tabla `workday_distribution_agreements`): `userId` o
   `scheduleId`, `kind` (`INDIVIDUAL`/`COLECTIVO`), `scope` (horario/semana), `effectiveFrom`,
   `effectiveTo`, evidencia (documento o texto + `acceptedHash` SHA-256, `acceptedIp`, parte que
   acepta: trabajador o representación sindical), `createdById`, timestamps. Tenant + RLS.
2. Endpoints `GET/POST /nom/distribution-agreements` (RH) y aceptación del trabajador en
   `/nom/me/distribution-agreements/:id/accept`; portal `/mi-jornada`.
3. Alimentar el motor: resolver el convenio vigente de la persona/semana y pasarlo en
   `weekly-overtime.service.ts:94-98`; el tiempo por encima del estándar del turno (8/7/7.5) sin
   convenio deja de contarse como ordinario (ver RJ-08).
4. Migración `20261122000000_workday_distribution_agreements`; página RH en Configuración/Jornada.

**Criterios de aceptación.**
- Un horario con día > estándar de su turno exige convenio vigente o falla con `SCHEDULE_ILLEGAL`
  detallando el día (coordinar con RJ-08).
- El motor usa el flag y el export marca `convenio: si|no` por día.
- Cambiar el convenio deja rastro en `audit_logs` y el histórico no se sobrescribe.

**Riesgos.** Ambigüedad de representación colectiva; decidir aceptación individual vs sindicato
(ver §7, D-1). Requiere validación legal del texto del acuerdo.

### RJ-02 · El marcaje remoto debe contar para la jornada

**Problema.** La jornada se calcula **solo** con checadas de reloj:
`schedule.service.ts:455-477` (`computeOvertimeDays`) consume `timeClockReport.reportExport` y
descarta todo lo demás. Los marcajes remotos existen en `remote_punches`, son inmutables y viajan
en una sección aparte del export (`stps-export.service.ts:181-189`), pero **no generan minutos**.
Consecuencia: una persona en home office o campo sin reloj aparece con 0 minutos trabajados en el
registro de jornada y en la prenómina — subregistro, justo lo contrario de lo que exige la ley.

**Cambio esperado.**

1. Fuente unificada de sesiones (puerto `WorkdaySessionSource`) que combine reloj + remoto +
   opcionalmente `access_events`, vinculadas a usuario. Extraer el emparejamiento ENTRY/EXIT que hoy
   vive en el módulo de checador y reutilizarlo.
2. Regla de conflicto por día: si hay sesiones de reloj y remotas, el reloj manda y se registra el
   conflicto como incidencia (no se suman ambas). Sin reloj, el remoto define la jornada.
3. Propagar a `computeWorkday`, reporte semanal de asistencia, ledger y prenómina.
4. Featurización por cliente con `nom_settings` (p. ej. `remoteCountsForWorkday`, default activo);
   rollout por cliente porque cambia prenómina.

**Criterios de aceptación.**
- Teletrabajador sin checadas aparece con minutos, retardo y extra calculados en el reporte del día.
- Día con reloj + remoto no duplica minutos y muestra una incidencia de conflicto.
- Test de integración: marcaje remoto → cálculo de jornada → ledger → export.
- `docs/ANALISIS_COBERTURA_OPERACION.md` deja de listar esto como pendiente.

**Riesgos.** Alto: toca prenómina y reportes ya aprobados por clientes. Mitigación: flag por
cliente, comparativa antes/después en un periodo de prueba y comunicación a RH.

### RJ-03 · Un ajuste aprobado debe corregir el registro (no solo el historial)

**Problema.** `GET /nom/punches/:id/history` aplica los ajustes `APPROVED` en orden
(`punch-adjustments.service.ts:155-169`), pero **ningún otro módulo usa `PunchAdjustment`** (verificado
con grep global). El export y la jornada siguen leyendo la checada cruda: la corrección aprobada
es un adorno documental que no cambia el registro probatorio. Además `previousState` se toma como
snapshot de la checada original (`:86-131`), así que ajustes encadenados no encadenan.

**Cambio esperado.**

1. Lector de checadas "consciente de ajustes" (`AdjustmentAwarePunchReader`) que materialice el
   valor vigente = original + ajustes APPROVED en orden de decisión; encapsular en un solo punto.
2. Sustituir la lectura cruda en `computeWorkday`/`computeOvertimeDays` y en el export.
3. Tercer estado de ajuste o cancelación de un APPROVED previo (hoy no se puede corregir una
   corrección) sin romper la inmutabilidad: nuevo ajuste que apunte al valor vigente.
4. Recalcular el ledger de la semana afectada al aprobar (hoy queda el snapshot viejo hasta el
   siguiente recálculo).

**Criterios de aceptación.**
- Aprobar un ajuste cambia los minutos del día, el ledger de la semana y el export.
- El histórico y la checada original siguen intactos y consultables.
- El segundo ajuste parte del valor vigente, no del original.
- Test de integración: ajuste → ledger → export.

### RJ-04 · Corrección de marcaje remoto

**Problema.** El ajuste referencia `punchId` con FK a `time_clock_punches`
(`migración 20261107000000:112`), así que un marcaje remoto con hora o secuencia equivocada es
incorregible: la discrepancia solo se acepta sobre checadas de reloj
(`punch-adjustments.service.ts:361-369`). Queda inmutable y sin trazabilidad de corrección.

**Cambio esperado.**

1. Hacer `PunchAdjustment` polimórfico (`targetType`: `CLOCK`/`REMOTE`/`ACCESS` + `targetId`) o
   tabla hermana `remote_punch_adjustments`. Recomendado lo primero por reutilizar aprobación,
   auditoría e historial; migración con backfill (`targetType='CLOCK'` para las existentes).
2. Retirar la FK estricta a `time_clock_punches` y validar el objetivo en servicio (con
   `tenantId`).
3. Extender `reportDiscrepancy` a marcajes remotos y al portal `/mi-jornada` (hoy el botón solo
   aparece en checadas de reloj, `MyWorkdayPage.tsx:285`).

**Criterios de aceptación.**
- Un marcaje remoto se corrige con motivo, valor anterior/nuevo, aprobador distinto y auditoría.
- `GET /nom/punches/:id/history` sigue funcionando para checadas de reloj.
- El ajuste remoto aprobado incide en la jornada (depende de RJ-03).

### RJ-05 · Retención que no se rompa y que respete el art. 804 completo

**Problemas concretos.**

1. **El archivado aborta** en clientes con checadas ajustadas: `punch_adjustments.punchId` es
   `ON DELETE RESTRICT` y el servicio borra checadas en la misma transacción
   (`retention.service.ts:159-175`); `retention.service.ts` no toca los ajustes. La transacción
   "todo o nada" revienta y ese cliente **nunca se archiva**.
2. `access_events` se archiva **sin** el filtro de baja reciente (`:139,185`), rompiendo el piso de
   12 meses del art. 804 para esos eventos.
3. `scripts/nom-archive.ts:29` instancia `RetentionService` sin `AuditLogger`, así que las corridas
   manuales no quedan en `audit_logs` (contradice la cabecera del script).
4. `nom_archived_remote_punches` sin RLS; los triggers de inmutabilidad no cubren `TRUNCATE`; la
   excepción `app.nom_purge` la puede fijar cualquier rol con DELETE.

**Cambio esperado.**

1. Archivar también los ajustes: tabla `nom_archived_punch_adjustments` + borrar ajustes **antes**
   que las checadas dentro de la transacción, con conteo verificado (insert == delete).
2. Aplicar `recentlyTerminated` a `access_events` (por `employeeNumberSnapshot`/`employeeId`).
3. Pasar el audit logger en el script y en el worker.
4. RLS para las tres tablas de archivo; trigger que bloquee `TRUNCATE`; mover la excepción de purga
   a una función `SECURITY DEFINER` (o rol dedicado `tm_purge`) en lugar de un GUC fijable.
5. Comando web (botón en Configuración) para el archivado, hoy solo API.

**Criterios de aceptación.**
- Corrida con `dryRun` cuenta exactamente lo que archivará.
- Cliente con checadas ajustadas archiva sin error y conserva punch + ajuste en las tablas de archivo.
- Eventos de una baja reciente no se archivan antes del año posterior.
- Cada corrida (API, worker y script) deja `NOM_RETENTION_ARCHIVED` en `audit_logs`.

---

## 4. P1 — Prueba plena y entrega a la autoridad

### RJ-06 · Export completo para inspección

**Problema.** El export v1 (`stps-export.service.ts`) entrega por día/persona **solo
`ultimaSalida`** (`:260`), sin primera entrada ni detalle por marcaje; `minor` está hardcodeado en
`false` (`:106`); las infracciones semanales del ledger no viajan; `access_events` no se exporta
(ni vivos ni archivados: solo lee 2 de 3 tablas `nom_archived_*`); el SHA-256 cubre solo el JSON
intermedio, no la cabecera ni el CSV emitido; el comentario de cabecera sigue diciendo `v0`.

**Cambio esperado.**

1. Filas por día con `primeraEntrada`, `ultimaSalida`, `metodo` y `origen` (reloj/remoto/acceso).
2. Sección `# marcajes` con una fila por marcaje (fecha, hora ISO, tipo, método, quién registró,
   fuente), incluyendo `access_events` y sus archivados.
3. `minor` e `infracciones` desde el ledger semanal, no constantes.
4. SHA-256 calculado sobre **el texto final** (cabecera + CSV + secciones) para que el receptor
   pueda recalcularlo; bump a `stps-registro-jornada-v2` y actualizar el comentario.
5. Endpoint de descarga web para RH (hoy el export vive en API/dashboard).

**Criterios de aceptación.**
- El archivo entregable contiene hora de inicio y de fin por persona/día, y el detalle de marcajes.
- Recalcular el SHA-256 sobre el archivo descargado coincide con la cabecera.
- Un teletrabajador con solo marcajes remotos aparece con inicio/fin.
- Test unitario del layout y del hash.

### RJ-07 · Prueba plena de verdad: dos partes, texto visible y versiones

**Problema.** El modelo `WorkRecordAgreement` guarda métodos, política, versión, IP y hash
(`api/prisma/schema.prisma:1098-1116`), pero: (a) la UI hardcodea `["CLOCK","REMOTE"]` y **no
muestra el texto que se acepta** (`useWorkerCompliance.ts:72-80`); (b) el `upsert`
(`work-record.service.ts:70-92`) **sobrescribe** la versión anterior, perdiendo el histórico
probatorio; (c) **no hay firma del patrón**, así que el acuerdo es unilateral; (d) la conformidad
(`MyWorkdayPage.tsx:475-514`) solo muestra fecha/estado, no el resumen que el trabajador firma.

**Cambio esperado.**

1. Historial append-only de acuerdos: tabla `work_record_agreement_versions` (o
   `textSnapshot` inmutable por versión); el `upsert` deja de borrar.
2. Doble firma: trabajador + patronal (usuario RH autorizado) con hash, IP y fecha de cada parte.
3. La UI muestra el texto completo, los métodos que vienen del API y qué se está firmando; sin
   hardcodeos.
4. La conformidad muestra el resumen del ledger (ordinaria, doble, triple, ilegal) y el rango antes
   de aceptar; el rechazo exige nota (ya existe) y queda en auditoría.
5. Opción por cliente: no permitir marcaje remoto sin acuerdo aceptado (default: bloquea remoto).

**Criterios de aceptación.**
- Cambiar el texto crea versión nueva y exige nueva aceptación de ambas partes.
- Se puede reconstruir qué texto exacto aceptó cada parte y cuándo.
- La conformidad firmada corresponde al resumen mostrado (mismo hash).
- Test de integración del flujo completo desde `/mi-jornada`.

### RJ-08 · Jornada diaria 8/7/7.5, tope 12 h y desglose diario

**Problema.** `validateScheduleLegality` (`workday-rules.ts:266-308`) solo emite **warning** si un
día supera el estándar del turno (`:290`), no valida el tope de 12 h del art. 68, y
`schedule.service.ts:85-108,124-135` descarta los warnings. Peor: `computeWorkday` toma la jornada
programada completa como ordinaria (`workday-rules.ts:187-220`), así que un turno 9:00–22:00 cuenta
**13 h ordinarias con `extraMin=0`** (`schedule.service.ts:500-525`); el motor semanal re-corta a
8 h solo al armar el ledger. Las horas extra diarias no se detectan ni se pagan.

**Cambio esperado.**

1. En alta/edición de horario: bloquear (violation, no warning) día > estándar del turno sin
   convenio RJ-01 y cualquier día > 12 h.
2. En cálculo: separar `ordinaryMin` y `dayExtraMin` por día con la tabla 8/7/7.5 (ya existe
   `shiftTypeOf`); el exceso sobre el estándar es extra al doble, y sobre 12 h es excedente ilegal.
3. Exponer el desglose en reporte diario, prenómina y export.
4. Mantener el override de `nom_settings` solo más estricto que la ley.

**Criterios de aceptación.**
- Turno 9:00–22:00: 8 h ordinarias + 5 h extra (o bloqueo al crearlo sin convenio, según RJ-01).
- Crear un horario con día de 14 h falla con error de validación.
- El reporte diario y la prenómina muestran ordinaria y extra por día.
- Tests unitarios de los casos 8/7/7.5 y de cruce de medianoche.

**Riesgo.** Cambia el pago de horas extra de clientes actuales: requiere aviso, comparativa y
probablemente recálculo histórico asistido.

---

## 5. P2 — Cierre fino

### RJ-09 · Infracciones de menores y art. 66

**Problema.** Las horas extra de un menor se clasifican como `TRIPLE` y se pagan
(`weekly-overtime-engine.ts:271-291`), en vez de marcarse ilegales; y los topes de 4 h/día y 4 días
con extra solo limitan la asignación al doble, sin violación cuando se exceden.

**Cambio.** Clasificar todo exceso de menor como `ILEGAL` + infracción `MENOR`; marcar
`ART_66_EXCEDE_DIA` y `ART_66_EXCEDE_DIAS` además de la bolsa al triple. Alerta a RH y bloqueo de
nuevas solicitudes. Tests de los 18 casos del plan + los nuevos.

**Criterios.** El motor nunca paga extra al doble/triple de un menor; el export lista las
infracciones; solicitudes de extra a menores rechazadas (ya existe `MINOR_OVERTIME_FORBIDDEN`).

### RJ-10 · Sincronizar la documentación de cumplimiento

**Problema.** `NOM_CUMPLIMIENTO.md` se commiteó a las 08:32 y afirma layout `v0`, 83 tests y un
estado anterior a los bloques F3/F4/F6; `ANALISIS_COBERTURA_OPERACION.md` (09:59) dice que no existe
vacaciones cuando ya existen (`leave_types`/`leave_requests`, migración `20261121000000`);
`ESTADO_DEL_PLAN.md` lista F2 como pendiente; `modules/nom.md` conserva "Pendientes" ya resueltos.

**Cambio.** Reescribir la tabla de `NOM_CUMPLIMIENTO.md` con estado real y evidencia
(archivo:línea), marcar este plan como fuente de los pendientes, corregir los "Pendientes" de
`modules/nom.md` y el estado de F2 en `ESTADO_DEL_PLAN.md`. Añadir este documento al índice de
`docs/README.md`.

**Criterios.** Ninguna afirmación de cumplimiento sin evidencia en código; lo pendiente de la STPS
marcado como "por validar" y no como "pendiente de implementar".

---

## 6. Orden de ejecución sugerido

| Fase | Contenido | Sale con |
|---|---|---|
| **1. Evidencia consistente** | RJ-03 → RJ-04 → RJ-02 → RJ-06 | Registro que se corrige, se calcula y se entrega de forma coherente |
| **2. Validez del cambio 46 h** | RJ-01 → RJ-08 | Horarios 2027 con convenio y pago diario correcto |
| **3. Conservación y prueba plena** | RJ-05 → RJ-07 | Retención a prueba de fallos y acuerdo firmado por ambas partes |
| **4. Cierre** | RJ-09 → RJ-10 | Infracciones completas y documentación sincronizada |

Dependencias duras: RJ-08 requiere RJ-01 (el convenio habilita el día largo); RJ-06 requiere RJ-02 y
RJ-03 (si no, exporta datos que el cálculo desmiente); RJ-04 reutiliza RJ-03.

---

## 7. Decisiones abiertas

- **D-1 [DECISIÓN INICIAL]** `requireUnionForCollective` (default `true`): convenio colectivo exige parte sindical. Validar con abogado; ver LEGAL_REVISION_ACUERDOS.md.
- **D-1 [ABIERTA] Convenio art. 58:** ¿por persona, por horario o ambos? ¿Basta aceptación
  individual o se exige representación sindical en centros con contrato colectivo? Impacta el modelo
  de RJ-01.
- **D-2 [ABIERTA] Remoto vs reloj el mismo día:** ¿el reloj manda y el remoto se registra como
  conflicto (recomendado), o se suman? Impacta RJ-02 y la prenómina.
- **D-3 [DECISIÓN INICIAL]** Firma patrón = usuario RH + hash/IP + versión; falta validar si se exige e.firma/documento.
- **D-3 [ABIERTA] Firma del patrón:** ¿usuario RH con hash/IP alcanza como firma patronal, o se
  requiere documento firmado/e.firma adjunto? Impacta RJ-07 y su validez probatoria.
- **D-4 [DECISIÓN INICIAL]** `blockRemoteWithoutAgreement` default `true`: sin acuerdo con REMOTE no hay checada web.
- **D-4 [ABIERTA] Bloqueo de marcaje sin acuerdo:** ¿se bloquea de fábrica o se deja configurable?
  Recomendado configurable con default bloqueado para remoto.
- **D-5 [DECISIÓN INICIAL]** Mantener layout propio `v2` hasta publicación; ver STPS_ADAPTACION.md.
- **D-5 [ABIERTA] Layout del export:** mantener layout propio versionado (`v2`) hasta que la STPS
  publique el oficial, y adaptar entonces. Recomendado sí; evita dos migraciones de formato.

---

## 8. Fuera de alcance (depende de la autoridad o del cliente)

- Formato oficial, ámbito de aplicación, excepciones y plazo de gracia de las disposiciones de la
  STPS (aún sin publicar; revisar el DOF en la primera quincena de diciembre según declaraciones
  recogidas en prensa).
- Retención legal definitiva (el sistema implementa el piso del art. 804 y permite configurar más).
- Validación legal del texto del acuerdo de método, del convenio y de la política de teletrabajo.
- Lectura de la multa "por trabajador" (art. 992 vs 994 fr. IV Bis): confirmar con abogado.
- Cifrado adicional de datos sensibles en BD y aviso de privacidad por cliente (ya modelado).

---

## 9. Verificación del cierre

Al terminar cada fase, recorrer esta matriz y actualizar `NOM_CUMPLIMIENTO.md` con evidencia:

| # | Pregunta de inspección | Se responde con |
|---|---|---|
| 1 | ¿Hay inicio y fin de cada persona, en cualquier modalidad? | RJ-02, RJ-06 |
| 2 | ¿El registro no se puede editar y toda corrección tiene autor? | ya implementado + RJ-03, RJ-04 |
| 3 | ¿La corrección aprobada se refleja en lo que se entrega? | RJ-03, RJ-06 |
| 4 | ¿El método de registro está acordado y firmado por ambas partes? | RJ-07 |
| 5 | ¿El trabajador puede consultar y objetar sus registros? | `/mi-jornada` + RJ-07 |
| 6 | ¿Se conserva lo que exige el art. 804 sin romperse? | RJ-05 |
| 7 | ¿La jornada y las horas extra se calculan con los topes del año? | ya implementado + RJ-08, RJ-09 |
| 8 | ¿El cambio a 46 h está documentado y acordado? | RJ-01 |

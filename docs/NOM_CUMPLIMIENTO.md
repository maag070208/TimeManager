# Cumplimiento: registro electrónico de jornada (LFT 2027) + NOM-037 teletrabajo

Checklist de validación contra el artículo de referencia
(https://www.rankmi.com/blog/nom-037-y-registro-de-jornada-2027-claves-para-tu-sistema).

**Precisión legal**: el registro electrónico de jornada no es la NOM-037. Viene de la
reforma a la LFT (art. 132, fracción XXXIV, DOF 01/05/2026; obligatorio 01/01/2027;
multa 250–5,000 UMA, art. 994 fr. IV Bis). La **NOM-037-STPS-2023** regula seguridad y
salud en teletrabajo (>40 % de la jornada), incluidos horarios y desconexión. Son dos
obligaciones que el sistema debe cubrir juntas. Las disposiciones generales de la STPS
que detallan la forma del registro aún no se publican: este documento es un mapeo
técnico, no una certificación legal. Validar con asesor cuando se publiquen.

## Requisitos → estado en TimeManager

| # | Requisito | Estado | Evidencia / pendiente |
|---|---|---|---|
| 1 | Registro electrónico de inicio y fin para **todos** (presencial, híbrido, remoto) | **Implementado** | Reloj Hikvision (presencial) + **marcaje remoto por web** (`POST /nom/me/punch`, home office/campo, idempotente, geolocalización opcional solo al marcar, `RemotePunch` append-only) y pantalla `/mi-jornada`. GPS opcional; el rastreo continuo no aplica por diseño. |
| 2 | Trazabilidad de cada marcaje | **Implementado (técnico)** | Checadas append-only por trigger de BD; correcciones como `PunchAdjustment` (quién, cuándo, por qué, valor anterior/nuevo, aprobador; sin autoaprobación). Historial por checada (`GET /nom/punches/:id/history`) + `audit_logs`. Regresión: `nom.flow.test.ts`. |
| 3 | Acceso del trabajador a sus registros y flujo de revisión/aprobación | **Implementado** | Portal web `/mi-jornada`: marcajes propios (reloj, accesos y remotos), marcaje de entrada/salida y reporte de discrepancia (`POST /nom/me/discrepancies`, entra al flujo de aprobación de ajustes). |
| 4 | Reportes listos para la STPS (por periodo/persona, registros, incidencias, horas extra) | **Implementado (layout versionado)** | `GET /nom/export/stps?period=…&date=…&format=csv\|json`: por persona/día con trabajados, programados, extra, descanso/sin horario, última salida; metadatos + SHA-256 de integridad. Layout `stps-registro-jornada-v0`: **se ajustará al formato oficial cuando se publique**. |
| 5 | Límites de jornada y horas extra configurables + alertas | **Implementado (técnico)** | `nom_settings` por cliente: 12 h/día (720 min) y tope semanal por año (`weeklyLimitForYear`: 48 h antes de 2027, 46 h 2027-2029, 40 h 2030+), override por `sys_config`/cliente. Barrido horario + `WorkdayLimitAlert` + aviso a RH (campanita y correo). `POST /nom/alerts/scan` para corrida manual. |
| 6 | Desconexión y horarios (NOM-037 teletrabajo) | **Implementado (técnico)** | Registro de teletrabajadores por cliente, política de teletrabajo/desconexión y aviso de privacidad editables con versiones y consentimiento, checklist inicial/periódico del lugar (8 puntos) y registro de comunicaciones fuera de jornada con aviso in-app (`/nom/telework/*`, pantalla `/teletrabajo`). Falta validación legal del contenido y horarios por colaborador (schedules ya los soporta). |
| 7 | Conexión directa con nómina | **Parcial** | Hay pre-nómina/cierres y export; falta que OT/retardos/incidencias **aprobadas** viajen al periodo de nómina sin captura manual. |
| 8 | Protección de datos personales (LFPDPPP 20/03/2025) | **Parcial** | Roles por permiso, foto/archivos privados (token/presignado), Ably por token, credenciales de reloj cifradas, **aviso de privacidad editable por cliente con consentimiento versionado**, geolocalización limitada al instante del marcaje y marcajes remotos en export sin coordenadas. Faltan: cifrado de datos sensibles en BD, retención legal validada y aviso validado por legal/cliente. |
| 9 | Checklist y condiciones del lugar de teletrabajo | **Pendiente** | Lista de verificación inicial/periódica de seguridad y salud del lugar de teletrabajo (NOM-037), y registro de lugares. |
| 10 | Equipo y violencia familiar (política de retorno a presencial) | **Pendiente** | Documentos/plantillas por cliente (no bloquea el registro de jornada). |

## Implementación F2-01..04 (registro electrónico de jornada)

| Requisito | Estado | Evidencia | Pendiente |
|---|---|---|---|
| Inmutabilidad de checadas | ✅ Implementado | Trigger append-only en `time_clock_punches`/`access_events` (migración `20261107000000_nom_immutability`) | — |
| Ajustes con quién/cuándo/por qué y aprobador | ✅ Implementado | `PunchAdjustment`, `/nom/punches/:id/adjustments|history`, aprobación por segundo usuario | Pantalla web de historial |
| Auditoría de correcciones y OT | ✅ Implementado | `audit_logs` + `GET /audit?entityId=…`; `OVERTIME_APPROVAL_DECISION` por decisión | — |
| Límites 12 h/día y tope semanal por año | ✅ Implementado | `nom_settings` + `weeklyLimitForYear` + barrido `WorkdayLimitAlert` | Validar tope legal/año con asesor |
| Alertas a RH | ✅ Implementado | Notificación in-app + correo por cola (`email_logs`) | — |
| Retención configurable + archivado | ✅ Implementado (técnico) | `nom_settings.retentionMonths`, tablas `nom_archived_*`, `POST /nom/retention/archive`, `scripts/nom-archive.ts` | Plazo legal definitivo |
| Export formal STPS | ✅ Implementado (layout v0) | `GET /nom/export/stps` CSV/JSON + SHA-256 | Formato oficial de la disposición STPS |
| Portal del trabajador | ✅ Implementado | `/mi-jornada`: marcajes, marcaje remoto, discrepancia y teletrabajo | — |
| Marcaje remoto (home office/campo) | ✅ Implementado | `POST /nom/me/punch` + `RemotePunch` append-only + `/mi-jornada` | Validar política de uso con cliente |
| NOM-037 teletrabajo | ✅ Implementado (técnico) | Registro, política/desconexión, checklist 8 puntos, desconexión (contactos) y aviso de privacidad versionado | Validación legal del texto/política |
| Sello encadenado por lote | 🟡 Parcial | Hash del export + inmutabilidad DB | Encadenado/firma por lote |
| Aviso de privacidad / consentimientos | 🟡 Modelo+texto editable | `nom_settings.privacyNotice` versionado y aceptación del trabajador | Validación legal del texto por cliente |

Módulo técnico: [modules/nom.md](modules/nom.md). Regresión: `api/tests/integration/nom.flow.test.ts` (8 casos) + unit `api/src/modules/nom/services/nom.logic.test.ts` (4 casos).

## Fuera del sistema (acción del usuario/legal)

- Publicación de las disposiciones generales de la STPS (validar cuando salgan).
- Aviso de privacidad y consentimientos por cliente.
- Política de teletrabajo formal por cliente (el sistema puede generarla/almacenarla).
- Validación con asesor legal antes de prometer “cumple”.

## Criterio de validación final

Cuando cierren los bloques F2-01..F2-04 + marcaje remoto + export STPS + límites 2027,
recorrer esta tabla requisito por requisito y actualizar estado con evidencia
(endpoint/pantalla/prueba), dejando en “pendiente legal” solo lo que depende de la
autoridad o del cliente.

---

## Validación final (2026-11-05) — evidencia

Corrida final del árbol: integración API **154/154** (43 suites), unit **83/83**,
E2E **67/67**, `tsc` API+web y lint en 0. Base DEV de Railway migrada (14
migraciones) y sembrada. La validación es **técnica**, no legal: no sustituye la
opinión de asesor ni las disposiciones generales de la STPS.

| # | Requisito | Evidencia en código | Estado |
|---|---|---|---|
| 1 | Registro electrónico inicio/fin, todas las modalidades | Reloj ISAPI (`time_clock_punches`), `access_events`, y **marcaje remoto** `remote_punches` con portal `/mi-jornada`; `POST /nom/me/punch` idempotente y secuencia validada | **Cubierto** |
| 2 | Trazabilidad y correcciones documentadas | Triggers append-only + `PunchAdjustment` (motivo, valor anterior/nuevo, solicitante, aprobador) + `audit_logs`; `GET /nom/punches/:id/history` | **Cubierto** |
| 3 | Acceso del trabajador a sus registros + discrepancia | `/mi-jornada` (marcajes propios de reloj/acceso/remoto), `GET /nom/me/punches`, `GET/POST /nom/me/discrepancies` | **Cubierto** |
| 4 | Reportes para la STPS | `GET /nom/export/stps` CSV/JSON por periodo y persona, con SHA-256 y layout versionado (`stps-registro-jornada-v0`) | **Cubierto (v0)**; formato oficial pendiente de la STPS |
| 5 | Límites de jornada y horas extra + alertas | `nom_settings` por cliente, 720 min/día, tope semanal por año (48 h <2027, 46 h 2027-2029, 40 h ≥2030), barrido con `computeWorkday` + `WorkdayLimitAlert` idempotente + aviso a RH | **Cubierto**; validar tope legal por año con asesor |
| 6 | Horarios y desconexión (NOM-037) | `TeleworkRegistration`, `TeleworkChecklist` (inicial/periódico), `OutOfHoursContact` con aviso, políticas versionadas y consentimiento (`/nom/me/telework/accept`) | **Cubierto**; contenido/validez legal por cliente |
| 7 | Conexión con nómina | Pre-nómina, cierres y decisiones de OT auditadas; aprobaciones consumidas por asistencia/nómina | **Cubierto**; integración con proveedor de nómina externo no aplica (export) |
| 8 | Protección de datos personales | Fotos/documentos privados con token/presignado, Ably por token con capability mínima, RLS por tenant, roles por permiso, GPS solo al marcar | **Cubierto**; aviso de privacidad por cliente (texto editable) y validación legal |

### Gaps que quedan fuera del sistema (acción del usuario/legal)

- **Formato oficial STPS** y retención definitiva: dependen de las disposiciones generales que se publiquen para 2027.
- **Contenido y validez legal** de la política de teletrabajo, desconexión y aviso de privacidad de cada cliente.
- **Sello encadenado por lote** del export (hoy hash por export) si la autoridad lo exige.
- **Cifrado adicional** de datos sensibles y consentimientos por cliente (modelo listo, texto y proceso legal pendientes).
- **Precios, dominio (`axzy.dev`), bucket S3 privado y rotación de Ably**: acciones administrativas.

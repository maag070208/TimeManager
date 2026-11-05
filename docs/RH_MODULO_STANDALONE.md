# Módulo de RH y Checadas — Producto independiente (NOM-037 / registro de jornada)

Objetivo: extraer el módulo de Recursos Humanos + Reloj (checadas) como producto vendible por separado, que cumpla el registro electrónico de jornada que entra en vigor en 2027.

> **Advertencia legal:** los requisitos normativos de este documento provienen de un artículo de un proveedor de software (Rankmi, 20-oct-2026), no del DOF ni de la STPS. Antes de venderlo como "cumple NOM", validar contra el texto oficial de la reforma a la LFT (art. 132, fracción XXXIV) y de las disposiciones de la STPS que detallan el registro, que aún deben publicarse.

---

## 1. Qué exige la norma (según la fuente, por validar)

| Requisito | Qué implica en el sistema | Dónde vive hoy |
|---|---|---|
| Registro electrónico de inicio y fin de jornada (presencial, híbrido, remoto) | Marcajes entrada/salida por persona, con fecha y hora exactas | `TimeClockPunch`, `AccessEvent`, reloj ZKTeco-like (`TimeClockSyncEvent`) |
| Trazabilidad de correcciones | Cada corrección: quién, cuándo, por qué (pista de auditoría) | **Implementado (F2-01/F2-02)**: `PunchAdjustment` + `audit_logs` y `GET /nom/punches/:id/history`; ver `modules/nom.md` |
| Acceso del trabajador a sus marcajes y reporte de discrepancias | Portal/app del empleado con flujo de revisión y aprobación | Pantalla "Diferencias" (`TimeClockDifferencesTab`), app móvil `PuertoNuevoApp` |
| Reportes por periodo o colaborador (registros, incidencias, horas extra), descargables | PDF/CSV de asistencia | `reports`, `schedules/weekly-attendance`, `/access/report` |
| Horas extra con reglas por turno y alertas de límite diario/semanal | Tope de 12 h diarias (ordinaria + extra); alertas | `schedules` (cálculo) + `nom` (límites configurables y alertas, F2-03) |
| Desconexión / horarios definidos por colaborador | Asignación de horarios por persona | `schedules` (`ScheduleAssignment`) |
| Integración con nómina | Exportar horas extra, retardos e incidencias aprobadas | `schedules/payroll` (`PayrollClosure`) |
| Datos personales (marcajes, ubicación, biometría) | Cifrado, acceso por rol, aviso de privacidad, geolocalización limitada al marcaje | `core/utils/security`, `@core/permissions` |
| Retención de registros | **No definido por la fuente** — definir política (p. ej. ≥ 5 años, por validar) | **Técnico implementado (F2-04)**: meses por cliente + archivado a `nom_archived_*`; la política legal sigue por validar |
| Integridad / anti-manipulación | **No definido por la fuente** — recomendado: registros inmutables + sello/hash | **Parcial (F2-01)**: checadas append-only por trigger de BD y export con SHA-256; falta sello encadenado/firma por lote |

Fechas que menciona la fuente: NOM-037 vigente desde 05-dic-2023; registro electrónico obligatorio y jornada de 46 h desde 01-ene-2027; reducción gradual a 40 h en 2030. Sanción citada: 250–5,000 UMA (art. 994 frac. IV Bis LFT).

---

## 2. Alcance del producto: qué sí entra

### Backend (`api/src/modules`)
- **`time-clock`** (47 rutas): relojes, sincronización, checadas, roster, personas del reloj.
- **`access`** (13 rutas): eventos de acceso, reporte de entradas/salidas, sesiones.
- **`hr`** (32 rutas): perfiles de personal, documentos, catálogos (género, tipo de sangre, tipo de documento), reportes disciplinarios.
- **`schedules`** (solo lo necesario para asistencia): horarios, asignaciones, `computeWorkday` (retardo, horas extra, faltas), `people-attendance.service`, `weekly-attendance`. **Sin esto no existe el reporte de asistencia ni el retardo.**
- **`overtime`**: aprobación de tiempo extra (lo que muestra la pantalla de Tiempo extra).

### Frontend (`web/src`)
- `pages/access/*` (TimeClock*, AccessReportPage) y `features/access/*` (report, time-clock, time-clock-employees, time-clock-differences, time-clock-inspect, time-clock-people, time-clock-roster, time-clocks, time-clock-camera).
- `entities/time-clock`, `entities/access`, `entities/hr`, `entities/schedule`, `entities/overtime`.
- `features/hr/*` (employee-detail, employee-records-board, disciplinary-reports), `pages/employees`, `features/user/employees-list`.
- `features/schedule/*` (assign, schedules-table, overtime-approval, weekly-attendance) y `pages/schedules`, `pages/overtime`.
- `widgets/time-clock-dashboard`, `widgets/employee-clock`, `widgets/employee-credential`, `widgets/disciplinary-report`, `widgets/reports`.
- Pantalla de Asistencias (`/hr/time-clock/entries-exits`), Tiempo extra (`/schedules/overtime/approval`).

### App móvil (`PuertoNuevoApp`)
- `feature/timeclock/TimeClockEntriesExitsScreen.kt` y `feature/schedules/PayrollScreen.kt`. Solo si se vende app móvil; si no, se excluye.

---

## 3. Dependencias que hay que cortar o reemplazar

Estas partes son del sistema completo y no deben ir en el producto de RH:

| Dependencia | Dónde aparece | Acción |
|---|---|---|
| **Tickets** (`ticket`, `ticketAssignment`) | `hr` (perfil del empleado muestra tickets) | Quitar del perfil o hacerlo opcional |
| **Inventario / préstamos** (`loan`, `loanReturn`) | Perfil del empleado (equipo asignado) | Quitar |
| **Hotel / Cocina / Langostín** | Assistant help registry (`widgets/assistant/model/helpRegistry.ts`), landing | Quitar del help y del catálogo |
| **Asistente Langostín** (`widgets/assistant`, `shared/ui/langostin*`) | `PrivateRoutes.tsx` monta `LangostinAssistant` globalmente | Opcional: no montarlo en el producto RH |
| **Roles / permisos completos** (`entities/permission/model/screens.ts`, `features/roles`) | Menú y guardas | Mantener solo `RequiresPermission` y un set reducido de permisos RH |
| **`removalCategory`** (baja de usuarios) | `time-clock-roster.service.ts` | Mantener (es parte del roster); revisar si el catálogo se simplifica |
| **`@modules/users/services/user.service`** (`AuditLogger`, `deactivate`) | access, time-clock | Mantener `users` mínimo (alta/baja/perfil) |
| **Departamentos y subáreas** | RH, checadas, reportes | Mantener (son la organización del cliente) |
| **Ably** (`@core/services/ably`) | Notificaciones en tiempo real | Opcional: el producto puede funcionar con polling |
| **Email queue / plantillas** | Notificaciones y reportes | Mantener solo para alertas de discrepancias y reportes |
| **Storage** (`@core/services/storage`) | Fotos y documentos de empleados | Mantener |

---

## 4. Modelos de datos mínimos (Prisma)

**Núcleo de identidad y organización**
- `User` (empleado + usuario de sistema), `Role`, permisos y `UserPermissionGrant`, `Department`, `Subarea`, `Site`, `Gender`, `BloodType`.

**Checadas y reloj**
- `TimeClock` (reloj físico/serie), `TimeClockEmployee` (vínculo número de reloj ↔ usuario), `TimeClockPunch` (checada), `TimeClockRosterEntry` + `TimeClockRosterRun` (carga de personas al reloj), `TimeClockSyncEvent` (bitácora de sincronización).
- `AccessEvent` (entradas/salidas por acceso), con `siteId` y `guardId`.

**Horarios y tiempo extra**
- `Schedule`, `ScheduleAssignment` (con `validFrom`), `OvertimeRequest`/aprobaciones, `PayrollClosure` (si se exporta a nómina).

**Expediente**
- `EmployeeDocument`, `DocumentType`, `DisciplinaryReport`.

**Auditoría**
- Tabla de auditoría (`audit`): debe registrar **correcciones de checadas y aprobaciones** con usuario, fecha y motivo. Hoy no está garantizado que las checadas tengan historial de cambios; **es el principal hueco para cumplir la NOM**.

---

## 5. Lo que hay que construir o endurecer para la NOM

1. **Inmutabilidad de checadas**: las correcciones no sobrescriben la checada; crean un registro de ajuste ligado (`originalPunchId`, `reason`, `createdById`, `createdAt`). **Implementado (F2-01)**: trigger append-only en `time_clock_punches` + `PunchAdjustment` con valor anterior/nuevo y aprobador. Ver `modules/nom.md`.
2. **Pista de auditoría** de correcciones y aprobaciones de tiempo extra (quién, cuándo, qué cambió, por qué). **Implementado (F2-02)**: cada ajuste y cada decisión de OT escriben en `audit_logs` con estado anterior/nuevo; filtro `entityId` en auditoría e historial por checada.
3. **Política de retención** configurable y documentada (por validar con la STPS / asesor legal). **Técnico implementado (F2-04)**: meses por cliente, archivado a tablas `nom_archived_*`, worker diario y comando manual; falta la validación legal del plazo.
4. **Sello de integridad** (hash encadenado o firma) sobre las checadas exportadas, para demostrar que no se alteraron. **Parcial**: el export incluye SHA-256 del contenido (incluidos los marcajes remotos) y las checadas/remotos son inmutables por DB; falta sellado encadenado por lote.
5. **Portal del empleado** para consultar sus marcajes y reportar discrepancias (hoy solo lo hace RH desde "Diferencias"). **Implementado (F2-01/F2-07)**: `/mi-jornada` en la web con marcajes propios, **marcaje remoto** (`POST /nom/me/punch`, home office/campo), reporte de discrepancia y teletrabajo; incluye geolocalización opcional solo al momento del marcaje.
6. **Exportación oficial** de reportes en formato que pida la autoridad (por definir cuando salga la disposición de la STPS). **Parcial**: `GET /nom/export/stps` (CSV/JSON versionado con hash); el layout oficial sigue pendiente.
7. **Alertas de límite de jornada**: tope de 12 h diarias (ordinaria + extra) y aviso al acercarse a los límites semanales (46 h en 2027). **Implementado (F2-03)**: límites por cliente, worker y aviso a RH (campanita + correo).
8. **Aviso de privacidad y consentimiento** para geolocalización y datos biométricos, con geolocalización limitada al momento del marcaje. **Implementado como modelo (F2-08)**: aviso editable por cliente (`nom_settings.privacyNotice`, versionado), aceptación del trabajador y geolocalización solo en el marcaje; el texto y su validez legal quedan a cargo de legal/cliente.
9. **Cifrado** de datos sensibles en reposo y control de acceso por rol en los endpoints de checadas. **Parcial**: archivos privados (F1C-01), credenciales de reloj cifradas (F1B-10), permisos por endpoint y aviso de privacidad versionado (F2-08); falta cifrado de campos sensibles en BD (p. ej. domicilio de teletrabajo).

---

## 6. Permisos mínimos del producto

Mantener solo permisos de RH: `time_clock.view`, `time_clock.write`, `time_clocks.manage`, `access.log`, `payroll.view`, `hr.view`/`hr.manage` (si existen), `schedules.manage`, `overtime.approve`, y `audit.view`. Quitar los de hotel, cocina, inventario, tickets y langostín.

---

## 7. Pasos sugeridos para separarlo

1. **Congelar el alcance** con la lista de la sección 2 y la de la sección 3.
2. **Monorepo mínimo**: crear un proyecto `rh-standalone` con `api` y `web` solo con los módulos y pantallas de la sección 2; el resto se queda en el repo original.
3. **Quitar acoplamientos** de la sección 3 (tickets, inventario, hotel, langostín, roles completos).
4. **Migración Prisma nueva** desde cero con solo los modelos de la sección 4; no reutilizar la base del sistema completo (regla del repo: no usar `DATABASE_URL` como shadow DB; migraciones SQL a mano con backfill si hace falta).
5. **Implementar los puntos de la sección 5**, empezando por inmutabilidad y auditoría de checadas (lo que más pesa para la NOM).
6. **Validar con asesor legal** los requisitos marcados "por validar" antes de vender.
7. **QA**: tsc, build, lint y pruebas unitarias del reloj y de `computeWorkday`. Según la regla del repo, no correr E2E salvo que se pida.

---

## 8. Riesgos y pendientes conocidos

- **Retardo mal calculado en pantalla**: el caso de Alberto Navarro (DEMO-911) muestra "Retardo 5:59 h" con entrada a las 14:58. Con su turno vespertino de datos de prueba (15:00) no debería haber retardo. Hay que revisar qué horario tiene asignado hoy antes de vender el reporte de retardos.
- **Requisitos normativos no publicados**: el formato de datos, la retención y la integridad aún no están definidos en las disposiciones de la STPS. Diseñar con margen para cambios.
- **Dependencia de `schedules`**: sin ese módulo no hay asistencia, retardo ni horas extra. No se puede vender "solo checadas" si el cliente quiere esos reportes; hay que incluirlo.
- **Geolocalización y biometría** son datos personales sensibles; el producto debe pedir consentimiento antes de activarlos.

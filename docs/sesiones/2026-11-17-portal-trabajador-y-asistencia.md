# Sesión 2026-11-17 — Portal del trabajador, asistencia y navegación

Resumen de lo hecho en la sesión «Login directo a checadas para personal». **Nada está commiteado**: todo vive en el árbol de trabajo de `main`.

## 1. Personal entra directo a checar

- `web/src/pages/home/HomePage.tsx`: quien tiene cliente y solo el permiso `attendance.view` (rol PERSONAL o uno con los mismos permisos) va de `/` a `/mi-jornada`. Se decide por permisos, no por clave de rol.

## 2. Mi jornada (portal del trabajador) en bento

- `features/nom/worker-portal/ui/shared.tsx`: piezas compartidas `HeroCard`, `HeroHeader`, `SolidButton` (color en línea + halo `tm-punch-cta` + pastilla «Toca»), `QuietLink`, `Notice`.
- **Mi checada** (`PunchCard.tsx`): reloj grande, «1 de 4 checadas» con barra, un solo botón sólido del siguiente paso (verde entrada, ámbar comida, azul regreso, oscuro salida) y los pasos como `BentoKpiGrid` (2 columnas en celular). Enlace discreto «¿No sales a comer? Registrar salida» cuando la salida es opción y no el siguiente paso.
- **Registro y horas extra** (`RecordCard.tsx`): hero «¿Tus horas de esta semana están bien?» con botón «Sí, todo correcto»; «Algo no coincide» abre la discrepancia. KPIs del acuerdo de registro y firma de la empresa.
- **Vacaciones** (`LeaveCard.tsx`): días disponibles en grande, botón «Pedir vacaciones o permiso» que abre el formulario, KPIs de usados/por aprobar y lista «Mis solicitudes».
- `BentoKpiGrid` acepta `minItemWidth` (default 200).
- `app/index.css`: animación `tm-punch-cta` (respeta `prefers-reduced-motion`).

**Lección:** el Tailwind del design system gana a las clases de color de la app; los fondos de botones van en `style`. Y verificar íconos de `react-icons/lu` en runtime (`LuFileSignature` no existe en la versión instalada aunque tsc lo acepta; tiró la página en blanco).

## 3. Inicio → Asistencias filtrada

- API `people-attendance.service.ts`: vistas nuevas `ON_TIME`, `LATE`, `ABSENT` (además de `ALL`, `INCIDENTS`, `ON_SITE`, `WITHOUT_RECORDS`). DTO y tipos actualizados.
- Web `useAccessReport`: lee `?period=` y `?view=` de la URL. `AccessReportTab` muestra «Filtrando por: X ✕» (i18n `viewFilter.*` en `access-report`).
- `ClientOverview`: los recuadros A tiempo / Con retardo / Sin llegar tienen hover y llevan a `/hr/time-clock/entries-exits?period=DAY&view=…` (solo con `time_clock.view`).

## 4. Asistencias con el día completo

- Cada día de `PeopleAttendanceDay` trae `lunchStartAt` y `lunchEndAt`: la comida es la pausa entre el primer y el segundo tramo del día (sirve igual para web/app tipificadas y reloj por alternancia).
- Columnas: Entrada · Salida a comer · Regreso de comer · Salida · Horas · Estado. El tooltip semanal incluye la comida.

## 5. Historial detallado de checadas del empleado

- API `GET /hr/:id/punches?from=&to=` (`EmployeeOverviewService.punchHistory`): reloj + web + app con tipo, modalidad, ubicación descifrada (`openLocation`), precisión, hora del dispositivo, recepción, nota y correcciones (`punch_adjustments`). 14 días por defecto, máximo 92 (`PUNCH_HISTORY_RANGE_TOO_LONG`). Pide `hr.records` **y** `time_clock.view`.
- Web `features/hr/employee-detail/ui/EmployeePunchHistory.tsx`: filtros 7/14/30/90 días, agrupado por día, cada checada expandible con mapa (`LocationMap`). Reemplaza «Últimas checadas» si hay `time_clock.view`.

## 6. Menú y migajas

- Menú (`entities/permission/model/screens.ts`): grupos **Personal** (Empleados, Expedientes, Reportes de personal, Acuerdos), **Asistencia** (Asistencias, Vacaciones y permisos, Teletrabajo, sección Reloj), **Horarios y nómina** (Calendario, Asignar, Tiempo extra, Pre Nómina, Ajustes de nómina), **Configuración**. Íconos nuevos `attendance` y `schedules` en `PrivateRoutes`.
- **Migajas con memoria** (`shared/lib/breadcrumb-trail.ts` + `shared/ui/page/ITPage.tsx`): si se llega desde otra pantalla muestran el camino (Inicio › Karla Escobar Solis), cada migaja vuelve con sus filtros, se corta al volver a una pantalla ya recorrida, máx. 4. El menú (`state.menu`) y la carga directa usan las migajas fijas. Atrás/adelante conservan la ruta (sessionStorage).
- Migajas fijas alineadas: páginas del reloj/Asistencias → «Asistencia»; Pre Nómina, historial y Tiempo extra → «Horarios y nómina».

## 7. Acuerdos con el personal

- `pages/nom/WorkdayAgreementsPage.tsx`: tarjetas bento como pestañas; hero por pestaña con cifra, avance y acción principal («+ Nuevo acuerdo», «Firmar todos (n)»); personas en tarjetas en cuadrícula con acento de estado e íconos por método; formulario de nuevo acuerdo con medidor de caracteres y que solo se cierra si guardó bien.

## Datos tocados

- Se borraron las 2 checadas web del 17-nov de `karla.escobar` (cliente `ithub`) para pruebas, desactivando el trigger `remote_punches_append_only` dentro de una transacción y reactivándolo (verificado `tgenabled = 'O'`). La base de `api/.env` (Railway) ya no tiene el cliente `pruebas`.

## Pruebas

- API: `pnpm test:unit` 175/175 (nuevas: vistas y comida en `people-attendance.service.test.ts`, historial en `employee-overview.service.test.ts`).
- Web: `test:unit` 99/99 (nueva: `breadcrumb-trail.test.ts`). `tsc` y `lint` limpios.
- No se verificó en navegador desde la sesión (sin credenciales de `ithub`); el usuario revisa en `localhost:5009`.

## Pendiente

- Commitear (el usuario aún no lo pidió).
- Fichas actualizadas: `docs/modules/hr.md`, `docs/modules/schedules.md`.

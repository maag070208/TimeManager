# Pruebas de flujos completos

Batería para probar TimeManager de punta a punta con datos aislados (nunca contra Railway).

## Capas

| Capa | Comando | Qué cubre |
|---|---|---|
| Unitarios | `pnpm --filter timemanager-api test:unit` | Motores puros: jornada/tiempo extra, reglas legales, fechas, teletrabajo, notificaciones |
| Integración | `pnpm db:test:up` + `pnpm --filter timemanager-api test:integration` | API real + BD limpia `tm_test*`: auth, tenant, checadas, horarios, prenómina, vacaciones, NOM, reportes |
| E2E | `node web/scripts/e2e-run.mjs` | Web real + API en `:4010` + mock de reloj: login por subdominio, prenómina, tiempo extra, configuración, verificación/cierre, Mi jornada |
| Smoke BD | SQL de abajo | Verificación y cierre quedan persistidos con quién/cuándo |

## Flujos cubiertos

- **Sesión y aislamiento por cliente**: login `acme.localhost`, permisos por rol, `acme` no ve datos de `beta`, plataforma sin cliente no entra a Mi jornada.
- **Checadas / reloj**: seed con ~450 checadas, mapeo al padrón del reloj, checada web/remota, incidencias de entrada/salida.
- **Horarios**: alta/edición, validación legal, transición 2027, defaults de asistencia por cliente.
- **Prenómina**: reporte semanal por persona/día, KPIs, resumida/detallada, export PDF/Excel, **verificar toda/por departamento**, **cerrar semana**, **historial** y reapertura.
- **Tiempo extra**: motor semanal LFT, aprobación/rechazo, solo lectura para RH.
- **Vacaciones y permisos**: saldo LFT, solicitud, solape/saldo, aprobación de RH, tipos con/sin goce.
- **Configuración del cliente**: semana (jueves→miércoles), tolerancias, límites legales, retención, checada web.
- **Mi jornada**: entrada → salida a comer → regreso de comer → salida, checadas del reloj y web, teletrabajo, conformidad semanal, vacaciones.
- **Cumplimiento NOM**: teletrabajo, acuses, exámenes, inspección, retención.

## Verificación y cierre en BD

`payroll_department_reviews` guarda cada departamento revisado (quién/cuándo); `payroll_week_closures` guarda el cierre y su snapshot inmutable (incluye las revisiones):

```sql
SELECT "weekStart", "closedAt", "reopenedAt", jsonb_pretty("snapshot")
FROM payroll_week_closures ORDER BY "closedAt" DESC;

SELECT "weekStart", "departmentName", "reviewedBy", "reviewedAt", "bulk"
FROM payroll_department_reviews ORDER BY "reviewedAt" DESC;

-- Checadas por cliente (fuente del reporte)
SELECT t.slug, count(p.id) AS checadas,
       min(p."occurredAt")::date AS desde, max(p."occurredAt")::date AS hasta
FROM tenants t LEFT JOIN time_clock_punches p ON p."tenantId" = t.id
GROUP BY t.slug ORDER BY 1;
```

## Resultados de referencia

- Unitarios: **115/115**.
- Integración en BD limpia (`tm_test_full`): **184/184** (52 suites).
- E2E web: **75/75** (escritorio + móvil; servidores y BD `tm_e2e` aislados).

> Regenerar datos de demo: `DATABASE_URL=...tm_e2e npx ts-node -r tsconfig-paths/register scripts/e2e-seed.ts` y luego `DEMO_TENANT_ID=<id> RLS_ENABLED=true ... prisma/mock-attendance.ts`.

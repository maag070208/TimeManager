# Matriz de usuarios y accesos — CheckLab (E2E/demo)

Fuente: seed real `api/scripts/e2e-seed.ts` y catálogo `api/prisma/seed-data/role_permissions.json`.
Contraseña común para todas las cuentas: `E2ePrueba123!` (solo local/E2E).

## 1. Cuentas

| Empresa | URL de login | Usuario | Nombre | Rol principal | Roles extra | # Emp. | Departamento | Puesto nómina | Propósito |
|---|---|---|---|---|---|---:|---|---|---|
| Plataforma | `http://localhost:5009/#/login` | `e2e.admin` | Admin Plataforma | `ADMIN` | — | — | — | — | Consola multi-cliente, clientes, planes, roles globales, agentes |
| Acme | `http://localhost:5009/#/acme/login` | `acme.admin` | Ana Administradora | `CLIENT_ADMIN` | — | 1001 | Administración | Administrativo | Administrador del cliente: todo el tenant |
| Acme | `http://localhost:5009/#/acme/login` | `acme.rh` | Rita Recursos | `HUMAN_RESOURCES` | — | 1002 | Recursos Humanos | — | RH: expedientes, asistencia, horarios, pre-nómina |
| Acme | `http://localhost:5009/#/acme/login` | `acme.staff` | Sergio Staff | `CLIENT_STAFF` | — | 1003 | Operaciones | Operativo | Personal: portal, checada web, teletrabajo, vacaciones |
| Acme | `http://localhost:5009/#/acme/login` | `acme.elena` | Elena Extra | `CLIENT_STAFF` | — | 1004 | Operaciones | — | Personal sin horario/puesto, para asignaciones |
| Acme | `http://localhost:5009/#/acme/login` | `acme.emilio` | Emilio Extra | `CLIENT_STAFF` | `CLIENT_ADMIN` | 1005 | Administración | — | Prueba de rol secundario (no principal) |
| Beta | `http://localhost:5009/#/beta/login` | `beta.admin` | Beto Administrador | `CLIENT_ADMIN` | — | 2001 | Administración | — | Aislamiento multi-tenant |
| Beta | `http://localhost:5009/#/beta/login` | `beta.staff` | Brenda Staff | `CLIENT_STAFF` | — | 2002 | Operaciones | — | Aislamiento multi-tenant / portal |

> En el E2E Playwright el host equivalente es `http://acme.localhost:5106` / `http://beta.localhost:5106` y la plataforma `http://localhost:5106`.

## 2. Datos operativos de cada cuenta

| Usuario | Horario vigente | Puesto de nómina | Vínculo reloj | Checadas demo |
|---|---|---|---|---|
| `e2e.admin` | — | — | — | — |
| `acme.admin` | Matutino | Administrativo | — | Sí, con HE |
| `acme.rh` | Matutino | — | 1002 | Sí |
| `acme.staff` | Matutino | Operativo | 1003 | Sí, con comida/retardo/HE |
| `acme.elena` | Sin asignar | Sin puesto | — | — |
| `acme.emilio` | Sin asignar | Sin puesto | — | — |
| `beta.admin` | Sin asignar | — | — | — |
| `beta.staff` | Sin asignar | — | 2002 | Sí (tenant beta) |

Reloj mock: `MOCK-SERIAL-0001` en `http://127.0.0.1:4801`, personas `1001/1002/1003`.

## 3. Matriz de capacidades por rol

Leyenda: **Sí** = acceso completo; **R** = solo lectura; **P** = propio/limitado; **—** = sin acceso.

| Módulo / capacidad | ADMIN | SUPPORT | CLIENT_ADMIN | HUMAN_RESOURCES | CLIENT_STAFF |
|---|---|---|---|---|---|
| Consola de clientes / planes | Sí | R | — | — | — |
| Alta/baja de clientes | Sí | — | — | — | — |
| Roles y permisos globales | Sí | — | — | — | — |
| Auditoría | Sí | R | Sí | — | — |
| Configuración del tenant | Sí | — | Sí | — | — |
| Catálogos | Sí | — | Solo lectura* | Solo lectura* | — |
| Personal: ver | Sí | R | Sí | Sí | — |
| Personal: alta/editar/baja | Sí | — | Sí | Sí | — |
| Expedientes/documentos | Sí | — | Sí | Sí | — |
| Actas administrativas | Sí | — | Sí | Sí | — |
| Departamentos/subáreas | Sí | — | Sí | — | — |
| Horarios: ver | Sí | R | Sí | Sí | — |
| Horarios: crear/editar/asignar | Sí | — | Sí | Sí | — |
| Relojes: ver/asistencia | Sí | Sí | Sí | Sí | — |
| Relojes: administrar/vincular | Sí | Sí | Sí | Sí | — |
| Checada web / Mi jornada | Sí | — | Sí | Sí | Sí (propio) |
| Teletrabajo / NOM-037 | Sí | — | Sí | Sí | Sí (propio) |
| Tiempo extra: ver | Sí | R | Sí | Sí | — |
| Tiempo extra: aprobar/confirmar | Sí | — | Sí | — | — |
| Pre-nómina: ver | Sí | — | Sí | Sí | — |
| Pre-nómina: revisar/cerrar | Sí | — | Sí | Sí | — |
| Puestos de nómina | Sí | — | Sí | — | — |
| Vacaciones/permisos: aprobar | Sí | — | Sí | Sí | — |
| Vacaciones: solicitar/cancelar | — | — | — | — | Sí (propio) |

\* El catálogo (`catalogs.manage`) es solo del ADMIN de plataforma; el cliente lo ve en modo lectura.

## 4. Permisos efectivos por rol (catálogo)

| Rol | Permisos |
|---|---|
| `ADMIN` | `reports.view`, `reports.export`, `hr.records`, `hr.disciplinary_reports`, `users.view`, `users.create`, `users.edit`, `users.delete`, `users.permissions`, `departments.manage`, `catalogs.manage`, `access.scan`, `access.log`, `access.void`, `access.sites`, `time_clock.view`, `time_clock.sync`, `time_clock.link`, `time_clocks.manage`, `schedules.view`, `schedules.manage`, `overtime.view`, `overtime.approve`, `dashboard.view`, `audit.view`, `system.configure`, `roles.manage`, `payroll.view`, `payroll.review`, `payroll.close`, `attendance.view`, `time_clock.write`, `tenants.view`, `tenants.manage`, `plans.view`, `plans.manage` |
| `SUPPORT` | `users.view`, `users.edit`, `time_clock.view`, `time_clock.sync`, `time_clock.link`, `time_clocks.manage`, `schedules.view`, `overtime.view`, `dashboard.view`, `audit.view`, `attendance.view`, `access.log`, `reports.view`, `tenants.view`, `plans.view` |
| `CLIENT_ADMIN` | `reports.view`, `reports.export`, `hr.records`, `hr.disciplinary_reports`, `users.view`, `users.create`, `users.edit`, `users.delete`, `users.permissions`, `departments.manage`, `access.scan`, `access.log`, `access.void`, `access.sites`, `time_clock.view`, `time_clock.sync`, `time_clock.link`, `time_clocks.manage`, `schedules.view`, `schedules.manage`, `overtime.view`, `overtime.approve`, `dashboard.view`, `audit.view`, `payroll.view`, `payroll.review`, `payroll.close`, `attendance.view`, `time_clock.write` |
| `HUMAN_RESOURCES` | `hr.records`, `hr.disciplinary_reports`, `users.view`, `users.create`, `users.edit`, `access.log`, `access.void`, `time_clock.view`, `time_clock.sync`, `time_clock.link`, `time_clock.write`, `schedules.view`, `schedules.manage`, `overtime.view`, `payroll.view`, `payroll.review`, `payroll.close`, `attendance.view`, `reports.view`, `reports.export`, `dashboard.view` |
| `CLIENT_STAFF` | `attendance.view` |

## 5. Casos de prueba por usuario

| Usuario | Debe poder | No debe poder |
|---|---|---|
| `e2e.admin` | Ver clientes, crear/suspender, asignar plan, impersonar, agente | Entrar a Mi jornada / ser tratado como personal |
| `acme.admin` | Administrar personal, horarios, relojes, HE, pre-nómina, roles del tenant | Ver clientes/planes de plataforma; administrar catálogos globales |
| `acme.rh` | Expedientes, asistencia, horarios, pre-nómina (revisar/cerrar) | Aprobar HE, roles, catálogos globales |
| `acme.staff` | Checar desde web, ver sus marcajes, reportar discrepancia, teletrabajo, vacaciones | Ver otros empleados, nómina, relojes, configuración |
| `acme.elena` | Ser asignada a horario/puesto por admin/RH | Tener datos propios aún (sin horario ni puesto) |
| `acme.emilio` | Acceso efectivo combinado `CLIENT_STAFF + CLIENT_ADMIN` por rol secundario | Ser principal del rol ADMINISTRADOR DEL CLIENTE |
| `beta.admin` / `beta.staff` | Operar su propio tenant | Leer datos de `acme` (aislamiento) |

## 6. Consulta para regenerar la matriz

```sql
SELECT t.slug AS empresa, u."employeeNumber" AS num, u.name, u.username,
       u.role AS rol_principal,
       COALESCE(array_to_string(array(SELECT ur.role FROM user_roles ur WHERE ur."userId" = u.id), ', '), '—') AS roles_extra,
       u."jobTitle" AS puesto, d.name AS departamento, p.name AS puesto_nomina,
       u."checkinMode", u.active
FROM users u
LEFT JOIN tenants t ON t.id = u."tenantId"
LEFT JOIN departments d ON d.id = u."departmentId"
LEFT JOIN payroll_positions p ON p.id = u."payrollPositionId"
ORDER BY t.slug NULLS FIRST, u."employeeNumber";
```

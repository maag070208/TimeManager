# Matriz de cobertura E2E (web)

Pruebas de extremo a extremo con **Playwright** sobre el stack local: API real en
`:4010` con la BD `tm_e2e`, reloj Hikvision simulado en `:4801` y web Vite en
`:5106` (los clientes entran por subdominio: `acme.localhost:5106`). El seed
(`api/scripts/e2e-seed.ts`) crea dos clientes y su personal con contraseña
conocida; corre antes de cada ejecución.

## Cómo correr

```bash
pnpm --filter timemanager-api db:test:up                         # Postgres local (55433)
cd web && node scripts/e2e-run.mjs tests/e2e --project=chromium  # una suite o todas
node scripts/e2e-run.mjs tests/e2e --project=mobile              # viewport móvil
```

`scripts/e2e-run.mjs` serializa las corridas (lock): el stack y la BD son únicos
y el seed trunca. El arnés se niega a correr contra una BD que no sea local
`tm_test*`/`tm_e2e`.

## Estado

- **A** = automatizada en este repo.
- **P** = pendiente (spec en la lista de trabajo).
- **M** = manual: depende de hardware real o de un tercero (reloj físico, correo real).

### Sesión y consola de plataforma

| Pantalla | Ruta | Funcionalidades | Test | Estado |
|---|---|---|---|---|
| Login | `/#/login` (plataforma y subdominio) | entrar plataforma, entrar cliente, contraseña mala, usuario de cliente sin slug | `auth.spec.ts` | A |
| Consola de plataforma | `/#/` (sin cliente) | lista de clientes, estado, entrar como cliente, suspender/reactivar | `tenants.spec.ts` | P |
| Inicio del cliente | `/#/` (con cliente) | bloques de primeros pasos, asistencia de hoy, accesos por permiso | `home.spec.ts` | A |
| Avisos | `/#/notifications` | lista de avisos, marcar leído | `notifications.spec.ts` | A |
| Roles | `/#/roles` | matriz, ficha de acceso por persona, regla ROLE_NOT_FOR_CLIENT | `roles.spec.ts` | P |

### Personal y expedientes

| Pantalla | Ruta | Funcionalidades | Test | Estado |
|---|---|---|---|---|
| Personal (lista) | `/#/employees` | listar, buscar, filtros, menú de acciones por fila | `personal.spec.ts` | P |
| Diálogo de cuenta | `/#/employees/:id/account` | abrir sobre la lista, editar cuenta, contraseña, baja, reactivar, eliminar | `personal.spec.ts` | P |
| Nuevo empleado | `/#/employees/new` | alta con datos mínimos, validaciones | `personal.spec.ts` | P |
| Importar | `/#/employees/import` | carga de plantilla Excel | `personal.spec.ts` | P |
| Historial | `/#/employees/:id/history` | timeline y auditoría | `personal.spec.ts` | P |
| Expediente | `/#/employees/:id` | pestañas del expediente, foto, documentos, credencial | `employees.spec.ts` | P |
| Editar perfil | `/#/employees/:id/edit` | datos personales, foto | `employees.spec.ts` | P |
| Catálogo de documentos | `/#/employees/catalogs/documents` | alta/edición de tipos | `employees.spec.ts` | P |
| Reportes de RH | `/#/employees/disciplinary-reports` | listar, alta, detalle | `employees.spec.ts` | P |
| Personal (móvil) | `/#/employees` | login móvil y lista usable | `personal.mobile.spec.ts` | P |

### Organización, horarios y nómina

| Pantalla | Ruta | Funcionalidades | Test | Estado |
|---|---|---|---|---|
| Departamentos | `/#/departments` | listar, crear, detalle | `departments.spec.ts` | P |
| Subáreas | `/#/subareas` | listar/crear | `departments.spec.ts` | P |
| Horarios | `/#/schedules` | listar, alta, edición | `schedules.spec.ts` | P |
| Asignación | `/#/schedules/assign` | asignar horario a persona | `schedules.spec.ts` | P |
| Tiempo extra | `/#/schedules/overtime/approval` | consultar y aprobar | `overtime-payroll.spec.ts` | P |
| Pre-nómina | `/#/schedules/payroll` | consultar, cerrar semana | `overtime-payroll.spec.ts` | P |

### Reloj checador

| Pantalla | Ruta | Funcionalidades | Test | Estado |
|---|---|---|---|---|
| Relojes | `/#/time-clocks` | listar, alta con credenciales por reloj, editar, habilitar escritura | `time-clocks.spec.ts` | P |
| Dashboard del reloj | `/#/time-clocks/dashboard` | estado, alertas, checadas de hoy | `time-clocks.spec.ts` | P |
| Personas del reloj | `/#/time-clocks/people` | padrón, tarjetas (mock) | `time-clocks.spec.ts` | P |
| Inspección | `/#/time-clocks/inspect` | equipo, cámaras, eventos (mock) | `time-clocks.spec.ts` | P |
| Resumen | `/#/hr/time-clock` | estado y últimas checadas | `access-time-clock.spec.ts` | P |
| Entradas/salidas | `/#/hr/time-clock/entries-exits` | reporte por periodo | `access-time-clock.spec.ts` | P |
| Roster | `/#/hr/time-clock/roster` | padrón y corridas | `access-time-clock.spec.ts` | P |
| Personal del reloj | `/#/hr/time-clock/employees` | vínculos reloj ↔ usuario | `access-time-clock.spec.ts` | P |
| Conciliación | `/#/hr/time-clock/employees/differences` | diferencias reloj vs sistema | `access-time-clock.spec.ts` | P |
| Huellas | (diálogo del expediente) | captura con estación DS-K1F600U | — | M |

### Fuera de la web

| Flujo | Cubierto por | Estado |
|---|---|---|
| Login/refresh/permisos/tenancy (API) | `api/tests/integration/*.flow.test.ts` (60 casos) | A |
| Aislamiento entre clientes | `tenancy.flow.test.ts` + `pnpm tenancy-check` | A |
| Credenciales por reloj / sync | `clock-credentials.flow.test.ts` (mock ISAPI) | A |
| Foto y archivos privados | `photo.flow.test.ts` | A |
| Ably por token | `ably.flow.test.ts` | A |
| Estación de huellas física | Requiere hardware | M |
| Correos reales | Requieren proveedor (Resend/SMTP) | M |

---

## Resultado de la corrida final (2026-11-05)

Suite completa con el runner serializado: **70/70 tests en 17 specs**.

| Spec | Tests | Cubre |
|---|---|---|
| `auth.spec.ts` | 4 | login plataforma/cliente, contraseña mala, staff sin slug |
| `home.spec.ts` | 4 | consola de plataforma, inicio de cliente, gating por rol |
| `personal.spec.ts` | 13 | lista, búsqueda/filtros, menú, cuenta con URL propia, alta, baja/reactivación, rutas viejas, puesto, eliminación, import, RH |
| `personal.mobile.spec.ts` | 1 | Personal en viewport móvil |
| `notifications.spec.ts` | 2 | bandeja y marcado leído con persistencia |
| `departments.spec.ts` | 5 | lista, alta, detalle/subárea, edición, baja suave, subáreas |
| `schedules.spec.ts` | 4 | lista, alta por asistente, edición, asignación |
| `overtime-payroll.spec.ts` | 3 | tiempo extra admin/RH y pre-nómina con periodos |
| `time-clocks.spec.ts` | 6 | lista, dashboard, personas, inspección, escritura on/off, alta contra mock |
| `access-time-clock.spec.ts` | 5 | resumen, entradas/salidas, padrón, empleados, conciliación |
| `roles.spec.ts` | 3 | matriz, "Agregar rol" filtrado con cliente y completo en plataforma |
| `tenants.spec.ts` | 5 | listado, suspender/reactivar, alta con correo, planes, entrar como cliente |
| `agent-console.spec.ts` | 2 | token crear/rotar/revocar y cola de trabajos |
| `nom-portal.spec.ts` | 3 | `/mi-jornada` staff, guard de `/teletrabajo`, administración NOM |
| `client-routes.spec.ts` | 7 | rutas por cliente (`/#/acme/...`), guards, legado y plataforma |
| `mi-jornada.spec.ts` | 2 | portal del trabajador (cliente) y Mi jornada oculta/regresada en plataforma |
| `mi-jornada.mobile.spec.ts` | 1 | portal en teléfono: usable y sin desbordes horizontales |

Pendiente como **manual (M)**: hardware real (estación DS-K1F600U, reloj físico),
subida real de Excel y acciones destructivas de nómina que exigen datos de
semanas completas.

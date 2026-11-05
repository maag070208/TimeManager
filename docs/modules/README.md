# Módulos del sistema

Una ficha por módulo de `api/src/modules/`. Cada ficha describe qué hace, sus endpoints, los modelos Prisma que toca, los permisos que usa, su frontend y lo que hay que resolver para el SaaS multi-cliente.

## Núcleo RH (el producto que se vende)

| Módulo | Qué cubre | Rutas | Ficha |
|---|---|---|---|
| `time-clock` | Relojes físicos, checadas, roster, biometría | 47 | [time-clock](time-clock.md) |
| `access` | Entradas/salidas por acceso (escaneo), sitios con geocerca | 13 | [access](access.md) |
| `hr` | Expediente de personal, documentos, catálogos, actas | 31 | [hr](hr.md) |
| `schedules` | Horarios, asignaciones, asistencia calculada, cierre de nómina | 19 | [schedules](schedules.md) |
| `overtime` | Aprobación de tiempo extra | 2 | [overtime](overtime.md) |

## Soporte (transversales, necesarios para operar)

| Módulo | Qué cubre | Rutas | Ficha |
|---|---|---|---|
| `auth` | Login, refresh, sesión, cambio de contraseña | 4 | [auth](auth.md) |
| `users` | CRUD de usuarios/empleados, importación, permisos directos | 16 | [users](users.md) |
| `departments` | Departamentos y subáreas (organización del cliente) | 12 | [departments](departments.md) |
| `permissions` | Roles, catálogo de permisos, políticas, simulación | 20 | [permissions](permissions.md) |
| `audit` | Consulta de la bitácora de auditoría | 2 | [audit](audit.md) |
| `notifications` | Notificaciones in-app + realtime (Ably) | 5 | [notifications](notifications.md) |
| `dashboard` | Agregaciones read-only para tableros por rol | 5 | [dashboard](dashboard.md) |
| `config` | Configuración del sistema (sys-config) | 4 | [config](config.md) |
| `email` | Cola y bitácora de correos, reintentos | 3 | [email](email.md) |

## Estado frente al SaaS

Ningún módulo tiene hoy aislamiento por cliente: no existe modelo `Tenant` y los datos cuelgan directo de `User`. El detalle está en [../SAAS_PLAN.md](../SAAS_PLAN.md); cada ficha tiene una sección "Notas multi-tenant" con lo que le toca a ese módulo.

## Notas

- Los directorios vacíos `inventory`, `kitchen`, `tickets`, `hotel-store`, `material-outputs`, `reports`, `suppliers` en `api/src/modules/` son residuo del ERP origen; el schema ya no tiene sus modelos. Pendiente borrar las carpetas.
- El router central es `api/src/modules/api.router.ts`; los módulos se montan con factory `create<Module>Module()`.
- Frontend: mapa de páginas/features en `web/docs/MODULES.md` (incluye módulos del ERP que ya no existen en la API — pendiente de poda igual que el backend).

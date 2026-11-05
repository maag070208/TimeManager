# Documentación — TimeManager

Documentación viva del producto. Se actualiza junto con el código; si un módulo cambia de alcance o de endpoints, se actualiza su ficha en el mismo PR/commit.

## Índice

| Documento | Contenido |
|---|---|
| [RH_MODULO_STANDALONE.md](RH_MODULO_STANDALONE.md) | Visión del producto: alcance RH standalone, requisitos NOM-037 / registro electrónico de jornada, huecos por construir |
| [PLAN_IMPLEMENTACION.md](PLAN_IMPLEMENTACION.md) | Roadmap ejecutable: arquitectura objetivo, decisiones y tareas por fase con ID, archivos y criterio de "hecho" |
| [SAAS_PLAN.md](SAAS_PLAN.md) | Plan de escalamiento a SaaS multi-cliente (multi-tenancy): decisiones, impacto por módulo y roadmap por fases |
| [ARQUITECTURA.md](ARQUITECTURA.md) | Arquitectura de escalamiento: API stateless + workers, colas, índices y particionado de la BD, performance de la web |
| [modules/](modules/README.md) | Ficha por módulo del sistema: qué hace, endpoints, modelos, permisos, frontend y notas multi-tenant |

## Convenciones

- Español para documentación y UI; código en inglés.
- Cada módulo de `api/src/modules/<modulo>` tiene su ficha en `docs/modules/<modulo>.md`.
- Las fichas marcan el estado del módulo frente al SaaS: **núcleo RH** (entra al producto), **soporte** (necesario pero transversal) o **pendiente SaaS** (requiere trabajo de aislamiento por cliente).
- Los requisitos normativos marcados "por validar" en `RH_MODULO_STANDALONE.md` no se dan por cerrados hasta confirmarlos contra el DOF / STPS.

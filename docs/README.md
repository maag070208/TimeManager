# Documentación — CheckLab

Documentación viva del producto. Se actualiza junto con el código; si un módulo cambia de alcance o de endpoints, se actualiza su ficha en el mismo PR/commit.

## Índice

| Documento | Contenido |
|---|---|
| [RH_MODULO_STANDALONE.md](RH_MODULO_STANDALONE.md) | Visión del producto: alcance RH standalone, requisitos NOM-037 / registro electrónico de jornada, huecos por construir |
| [PLAN_CUMPLIMIENTO_JORNADA.md](PLAN_CUMPLIMIENTO_JORNADA.md) | Plan para cumplir al 100 % NOM-037 + reforma LFT 2026: motor semanal de horas extra (doble/triple/topes), registro con prueba plena, transición 46→40 h y brechas de teletrabajo |
| [PLAN_CIERRE_HUECOS_JORNADA.md](PLAN_CIERRE_HUECOS_JORNADA.md) | Plan de cierre de los 10 huecos técnicos del registro electrónico de jornada detectados en la auditoría de código (RJ-01..RJ-10): convenio art. 58, remoto en el cálculo, ajustes en el export, retención, prueba plena |
| [ANALISIS_COBERTURA_OPERACION.md](ANALISIS_COBERTURA_OPERACION.md) | Cobertura operativa real: retardos, turnos 9–22 y 22–05, vacaciones pagadas/no pagadas, descanso, multi-industria, prenómina, checada web y riesgo legal; qué falta y prioridades |
| [PLAN_IMPLEMENTACION.md](PLAN_IMPLEMENTACION.md) | Roadmap ejecutable: arquitectura objetivo, decisiones y tareas por fase con ID, archivos y criterio de "hecho" |
| [SAAS_PLAN.md](SAAS_PLAN.md) | Plan de escalamiento a SaaS multi-cliente (multi-tenancy): decisiones, impacto por módulo y roadmap por fases |
| [ARQUITECTURA.md](ARQUITECTURA.md) | Arquitectura de escalamiento: API stateless + workers, colas, índices y particionado de la BD, performance de la web |
| [OPERACION_PRODUCCION.md](OPERACION_PRODUCCION.md) | Runbook de producción: procesos/workers, RLS, cola pg-boss, PgBouncer, observabilidad, respaldo/restore por cliente y prueba de carga |
| [QA_MATRIX.md](QA_MATRIX.md) | Matriz QA integral: 49 pantallas, 39 tabs, 71 modales, acciones críticas, cobertura actual y orden de implementación de pruebas |
| [modules/](modules/README.md) | Ficha por módulo del sistema: qué hace, endpoints, modelos, permisos, frontend y notas multi-tenant |

## Convenciones

- Español para documentación y UI; código en inglés.
- Cada módulo de `api/src/modules/<modulo>` tiene su ficha en `docs/modules/<modulo>.md`.
- Las fichas marcan el estado del módulo frente al SaaS: **núcleo RH** (entra al producto), **soporte** (necesario pero transversal) o **pendiente SaaS** (requiere trabajo de aislamiento por cliente).
- Los requisitos normativos marcados "por validar" en `RH_MODULO_STANDALONE.md` no se dan por cerrados hasta confirmarlos contra el DOF / STPS.
- [Matriz QA integral](QA_MATRIX.md)
- [Pruebas de flujos completos](PRUEBAS_FLUJOS.md)
- [Revisión legal de acuerdos](LEGAL_REVISION_ACUERDOS.md)
- [Adaptación STPS](STPS_ADAPTACION.md)
- [Plan de nómina México](PLAN_NOMINA_MEXICO.md)
- [Módulo payroll](modules/payroll.md)

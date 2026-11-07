# Datos demo

Tres empresas ficticias con operación "real" para demos, QA manual y capturas. Todo es inventado: nombres, RFC/CURP/NSS (con formato válido, no reales), domicilios y correos (dominio reservado `.test`).

```bash
pnpm demo:seed                     # usa DATABASE_URL de api/.env
DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_demo pnpm demo:seed   # BD local
```

Script: `api/scripts/demo-seed.ts`; las empresas, horarios, puestos y relojes viven en `api/scripts/demo/companies.ts`.

## Reglas

- **Aditivo**: no borra nada. Si el slug de una empresa ya existe, esa empresa se salta completa.
- **No se puede resembrar** una empresa en la misma BD: checadas, marcajes remotos y bitácora son append-only por trigger (NOM). Para empezar de cero, usa una BD local nueva.
- No corre con `NODE_ENV=production` (salvo `DEMO_SEED_FORCE=1`).
- Las fechas son relativas al día de la corrida: siempre hay 5 semanas de historia hasta hoy.
- Las horas extra, ledgers semanales, constancias y ajustes salen de los servicios reales (`ScheduleService.computeOvertimeDays`, `WeeklyOvertimeService`, `WorkRecordService`, `PunchAdjustmentsService`), no de cifras escritas a mano.
- Los relojes demo apuntan a IPs privadas inexistentes: si la API corre su worker de sincronización contra esa BD, registrará intentos fallidos cada 5 min.

## Empresas

| Slug | Empresa | Giro | Personas | Relojes | Semana |
|---|---|---|---|---|---|
| `altamira` | Grupo Logístico Altamira | CEDIS y transporte: 3 turnos (incluye nocturno), operadores de ruta, oficina | 44 | 2 | miércoles |
| `santalucia` | Clínica Santa Lucía | Enfermería por turnos, guardia nocturna, laboratorio, cobranza remota | 30 | 1 | lunes |
| `origen` | Café Origen | 3 sucursales con apertura/cierre, tostaduría y oficina | 21 | 3 | lunes |

Cada empresa trae: departamentos y subáreas, puestos de nómina con salario y SBC, horarios con días de descanso, expediente completo (RFC, CURP, NSS, domicilio, contacto de emergencia, documentos), vínculos reloj ↔ persona, padrón del reloj con una baja pendiente, festivos (y uno de convenio en la clínica), configuración NOM y de nómina.

Flujos sembrados:

- **Checadas** de 5 semanas generadas desde el horario de cada persona: llegadas puntuales, retardos, faltas, comida (4 checadas), olvidos de salida, tiempo extra (más al cierre de mes), el festivo del 16 de noviembre y guardias que sí trabajan festivos. Hoy solo hay checadas hasta la hora de la corrida.
- **Marcaje web** (teletrabajo remoto e híbrido) con geolocalización puntual.
- **Tiempo extra**: decisiones aprobadas/rechazadas por semana; la última semana queda con pendientes por aprobar.
- **Ledgers semanales**: semanas anteriores cerradas, la última confirmada (con algunos DRAFT por revisar), la actual en DRAFT.
- **Pre-nómina**: semanas anteriores revisadas por departamento y cerradas con su fotografía; la última semana a medio revisar.
- **Alertas de jornada** > 12 h derivadas de lo trabajado.
- **Vacaciones y permisos**: aprobados (sin checadas esos días), incapacidad, pendientes, rechazado y cancelado.
- **Ajustes de checada** por olvido de salida: pendientes, aprobados por una segunda persona y uno rechazado.
- **Solicitudes previas de horas extra**: aceptada, pendientes y rechazada por el trabajador.
- **Constancias semanales** del trabajador (aceptadas y alguna discrepancia).
- **Acuerdos** de método de registro firmados por ambas partes y convenios de distribución para turnos nocturnos.
- **Teletrabajo NOM-037**: registros, checklist inicial validado y periódico pendiente, contacto fuera de horario.
- **Actas** por faltas y retardos reales de la historia, descuentos (INFONAVIT/IMSS/pensión).
- Una **baja** voluntaria reciente, dos **altas** recientes, un **cambio de turno** hace dos semanas.
- **Plataforma**: kardex de pagos mensual desde el alta de cada cliente (Café Origen con un mes vencido) y la instalación de relojes.

## Cuentas

Contraseña de todas: `Demo2026!` (constante `DEMO_PASSWORD` del script). En local se entra por subdominio: `http://<slug>.localhost:5006`.

| Empresa | Usuario | Rol |
|---|---|---|
| altamira | `ricardo.salinas` | Administrador del cliente |
| altamira | `veronica.ibarra` | Recursos Humanos |
| altamira | `hugo.castaneda` | Personal (supervisor de almacén, reloj) |
| altamira | `karla.nunez` | Personal (híbrido: reloj + web) |
| santalucia | `lucia.arellano` | Administradora del cliente |
| santalucia | `gabriel.orozco` | Recursos Humanos |
| santalucia | `teresa.villalobos` | Personal (jefa de enfermeras, reloj) |
| santalucia | `andrea.preciado` | Personal (teletrabajo 100 %) |
| origen | `mateo.lozano` | Administrador del cliente |
| origen | `paola.duarte` | Recursos Humanos |
| origen | `itzel.camacho` | Personal (encargada de sucursal) |

El resto del personal también puede entrar con la misma contraseña; su usuario es `nombre.apellido` (ver la pantalla de Personal).

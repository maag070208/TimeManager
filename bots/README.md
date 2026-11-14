# Bots: las personas de prueba de CheckLab

Esta carpeta describe a las personas simuladas que usan el sistema como lo haría
una empresa real: quiénes son, cómo se comportan y qué flujos recorren. Cada
ficha es un archivo Markdown; el código que las mueve vive en el API:

| Qué | Dónde | Para qué |
| --- | --- | --- |
| Reparto y flujos contra el API | `api/qa/cast.ts`, `api/qa/flows/*.ts` | Recorren los flujos de punta a punta (alta, horarios, checadas, permisos, horas extra, NOM-037, sesiones) y reportan hallazgos en `api/qa/out/report.md`. Solo contra un API local y una base `tm_qa*`. |
| Simulador de semana | `api/scripts/simulate-week.ts` (`pnpm --filter timemanager-api qa:simular`) | Llena de entradas y salidas la semana de un cliente para ver asistencia, pre-nómina y tiempo extra con datos. Escribe en la base de `api/.env`. |

## Correr

```bash
pnpm --filter timemanager-api qa:bots:local            # todos los flujos, API temporal en 4031 y base tm_qa
pnpm --filter timemanager-api qa:bots:local jornada    # un solo flujo
```

```bash
pnpm --filter timemanager-api qa:simular -- --tenant=panaderia --weeks=2 --dry-run
pnpm --filter timemanager-api qa:simular -- --tenant=panaderia --weeks=2
```

El simulador toma a las personas activas con número de empleado y horario
vigente del cliente, y a cada una le asigna un **carácter** por orden de número
de empleado (se repite cada seis):

| Orden | Carácter | Qué hace en la semana |
| --- | --- | --- |
| 1 | `puntual` | Llega y sale a su hora, ±4 min. |
| 2 | `retardos` | Lunes, miércoles y viernes llega 15–25 min tarde. |
| 3 | `falta` | El miércoles no se presenta. |
| 4 | `extra` | De lunes a jueves sale 1 h 15 – 2 h después: tiempo extra por aprobar. |
| 5 | `remoto` | Trabaja desde casa (modalidad REMOTO) y entra un par de minutos antes. |
| 6 | `temprano` | Miércoles y sábado sale 40–60 min antes. |

Las checadas quedan como marcajes web (`remote_punches`, fuente WEB) con la hora
en la zona del cliente, dentro de la semana del cliente (`weekStartDay`), solo en
días ya transcurridos. Un día que ya tenía marcajes se respeta, así que correrlo
dos veces no duplica. Como la tabla es de solo inserción, para deshacer una
simulación hay que purgarla con el procedimiento de retención (`app.nom_purge`).

## Fichas

- [Plataforma](plataforma.md) — equipo CheckLab, da de alta clientes.
- [Admin del cliente: Alejandra](admin.md) — configura la empresa.
- [Recursos Humanos: Roberto](rh.md) — horarios, expedientes, permisos, pre-nómina.
- Personal (Almacén): [Lucía](lucia.md), [Marco](marco.md), [Daniela](daniela.md).
- Personal (Oficina): [Óscar](oscar.md), [Fernanda](fernanda.md), [Jorge](jorge.md).
- [Intrusos: Tomás e Iván](intrusos.md) — otro cliente, para probar aislamiento.

Los flujos que recorre cada persona están en [FLUJOS.md](FLUJOS.md).

## Escribir una persona nueva

1. Agrega su ficha aquí (quién es, horario, carácter, qué debe poder y qué no).
2. Si la necesita un flujo contra el API, créala dentro del flujo
   (`api/qa/flows/<flujo>.ts`), nunca en el reparto base: cada flujo deja el
   reparto como lo encontró.
3. Si solo la necesitas para datos de la semana, basta darla de alta en el
   cliente con horario: el simulador la toma sola.

# Bots de operación

Scripts que hacen tareas repetitivas contra el **API real** (no tocan la base de datos).
Son idempotentes: si el empleado o el horario ya existen, los reutilizan.

## `alta-empleados-turnos.mjs`

Da de alta N empleados, crea los turnos (horarios) y les asigna horario a cada persona.
Pensado para dejar un cliente listo para probar (por ejemplo `panaderia` en local).

```bash
BOT_USER=martin.garcia BOT_PASS='...' pnpm bot:alta
```

Antes de escribir conviene ver el plan:

```bash
BOT_USER=martin.garcia BOT_PASS='...' BOT_DRY_RUN=1 pnpm bot:alta
```

| Variable | Default | Para qué |
| --- | --- | --- |
| `BOT_API_URL` | `http://127.0.0.1:4011/api/v1` | API a usar (debe ser loopback salvo `BOT_ALLOW_REMOTE=1`) |
| `BOT_TENANT` | `panaderia` | Slug del cliente |
| `BOT_USER` / `BOT_PASS` | — | Cuenta con `users.create` y `schedules.manage` |
| `BOT_COUNT` | `5` | Cuántos empleados del catálogo crear |
| `BOT_EMP_PASSWORD` | `Panaderia2026!` | Contraseña provisional de las cuentas nuevas |
| `BOT_FROM` | inicio de la semana del cliente | Vigencia de la asignación (`YYYY-MM-DD`) |
| `BOT_SHIFTS` | 2 turnos L–V | JSON de turnos: `name`, `startTime`, `endTime`, `mealBreakMin`, `assignedTo` |

Por defecto crea:

- **Turno Matutino** L–V 08:00–17:00 (comida 60 min, sáb/dom descanso).
- **Turno Vespertino** L–V 13:00–22:00 (comida 60 min, sáb/dom descanso).
- 3 personas al Matutino y 2 al Vespertino.

El alta usa el contrato actual del API: **sin correo y sin documentos** (ambos opcionales).

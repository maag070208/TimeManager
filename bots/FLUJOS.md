# Flujos que recorren los bots

Cada flujo es un archivo en `api/qa/flows/`; corren en orden alfabético sobre el
mismo reparto y cada uno crea lo que necesita sin romper a los demás. El reporte
de la última corrida queda en `api/qa/out/report.md`.

| Flujo | Archivo | Quién participa | Qué prueba |
| --- | --- | --- | --- |
| Sesiones | `sesiones.ts` | todos | Cada persona entra con su cuenta, ve su perfil y su cliente; refresh y tokens alterados. |
| Personal y roles | `personal-roles.ts` | Alejandra, Roberto, Lucía, intrusos | Alta por admin y por RH, expediente, edición, cambio de departamento, búsqueda, baja y reactivación, contraseña reseteada, matriz de permisos por rol, excepciones por usuario, roles de plataforma con `X-Tenant-Id`, límite de personas del plan, aislamiento entre clientes y conteos del inicio. |
| Horarios | `horarios.ts` | Roberto, Alejandra, personal extra | Alta de horarios (Matutino, Corrido), límites legales (60 h, 7 días, 13 h netas), asignación, asistencia semanal y pre-nómina de punta a punta. |
| Jornada | `jornada.ts` | los seis de la plantilla, Roberto, Alejandra, Iván | Configuración NOM del cliente, modo de checada y acuerdo del método; el día de cada persona con sus variaciones; secuencia, offline e idempotencia; consulta de marcajes propios; discrepancia → ajuste → aprobación por otra persona; asistencia del día para RH; aislamiento. |
| Permisos | `permisos.ts` | Roberto, Lucía, Marco, Óscar | Catálogo de tipos y festivos, saldo LFT por antigüedad, solicitudes (normales, con fin de semana o festivo, encimadas, sin saldo, inválidas, pasadas), cancelación, decisión de RH/admin, avisos, reflejo en la asistencia semanal, aislamiento. |
| Horas extra | `horas-extra.ts` | Alejandra, Roberto, personal extra | Configuración NOM, solicitud y consentimiento de extra, aprobación por día, ledger semanal (doble/triple/excedente), constancia semanal, alertas de jornada. Deja la configuración como la encontró. |
| NOM-037 | `nom-cumplimiento.ts` | Raúl y Teresa (creados por el flujo), Roberto | Acuerdo de método de registro (propuesta, aceptación, firma del patrón), teletrabajo (registro, consentimiento, lista de verificación, lugar APTO / NO_APTO), checada remota condicionada, export STPS. |

## Pantallas que se revisan a mano con la simulación

Con `qa:simular` corrido sobre un cliente, estas pantallas deben verse con datos
y cuadrar entre sí:

- **Inicio del cliente**: quiénes llegaron, con retardo y sin llegar hoy.
- **Asistencias** (`/hr/time-clock/entries-exits`): jornadas armadas por persona.
- **Pre-nómina** (`/schedules/payroll`): horas, faltas y tiempo extra por semana; verificar por departamento y cerrar.
- **Tiempo extra** (`/schedules/overtime/approval`): lo que dejó la persona con carácter `extra` por aprobar.
- **Expediente → Actividad**: últimas checadas de la persona.
- **Mi jornada** (entrando como cada persona): su propia semana y el botón de reportar discrepancia.

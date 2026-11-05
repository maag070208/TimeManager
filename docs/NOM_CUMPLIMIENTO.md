# Cumplimiento: registro electrónico de jornada (LFT 2027) + NOM-037 teletrabajo

Checklist de validación contra el artículo de referencia
(https://www.rankmi.com/blog/nom-037-y-registro-de-jornada-2027-claves-para-tu-sistema).

**Precisión legal**: el registro electrónico de jornada no es la NOM-037. Viene de la
reforma a la LFT (art. 132, fracción XXXIV, DOF 01/05/2026; obligatorio 01/01/2027;
multa 250–5,000 UMA, art. 994 fr. IV Bis). La **NOM-037-STPS-2023** regula seguridad y
salud en teletrabajo (>40 % de la jornada), incluidos horarios y desconexión. Son dos
obligaciones que el sistema debe cubrir juntas. Las disposiciones generales de la STPS
que detallan la forma del registro aún no se publican: este documento es un mapeo
técnico, no una certificación legal. Validar con asesor cuando se publiquen.

## Requisitos → estado en TimeManager

| # | Requisito | Estado | Evidencia / pendiente |
|---|---|---|---|
| 1 | Registro electrónico de inicio y fin para **todos** (presencial, híbrido, remoto) | **Parcial** | Reloj Hikvision (ISAPI) y módulo access cubren presencial/oficina. Falta **marcaje por app/web para home office y campo** (con o sin GPS) — diseñar API de marcaje y pantalla del empleado. |
| 2 | Trazabilidad de cada marcaje | **En curso (F2-01)** | Se implementa inmutabilidad + registro de ajustes (quién, cuándo, por qué, valor anterior/nuevo) y auditoría. Hasta que aterrice: no cumplido. |
| 3 | Acceso del trabajador a sus registros y flujo de revisión/aprobación | **Parcial** | El empleado ya ve su asistencia (inicio del cliente); falta consulta de marcajes puntuales con reporte de discrepancia y flujo de aprobación. |
| 4 | Reportes listos para la STPS (por periodo/persona, registros, incidencias, horas extra) | **Parcial** | Existen reportes de asistencia, retardos y horas extra; falta un **export formal “STPS”** con formato/periodo/firma y descarga para auditoría. |
| 5 | Límites de jornada y horas extra configurables + alertas | **Parcial** | `computeWorkday` calcula retardos/OT con tolerancias por horario. Faltan **límites legales configurables**: 12 h/día (ordinaria + extra), topes semanales por año (46 h en 2027 → 40 h en 2030) y **alertas** al acercarse (F2-03). |
| 6 | Desconexión y horarios (NOM-037 teletrabajo) | **Pendiente** | Falta **registro de teletrabajadores**, política de teletrabajo/desconexión documentada por cliente, horarios definidos por colaborador y control de comunicaciones fuera de jornada. |
| 7 | Conexión directa con nómina | **Parcial** | Hay pre-nómina/cierres y export; falta que OT/retardos/incidencias **aprobadas** viajen al periodo de nómina sin captura manual. |
| 8 | Protección de datos personales (LFPDPPP 20/03/2025) | **Parcial** | Roles por permiso, foto/archivos ahora privados (token/presignado), Ably por token. Faltan: aviso de privacidad por cliente, cifrado de datos sensibles en BD más allá de credenciales de reloj, y límites de geolocalización (solo al momento del marcaje) para la app de home office. |
| 9 | Checklist y condiciones del lugar de teletrabajo | **Pendiente** | Lista de verificación inicial/periódica de seguridad y salud del lugar de teletrabajo (NOM-037), y registro de lugares. |
| 10 | Equipo y violencia familiar (política de retorno a presencial) | **Pendiente** | Documentos/plantillas por cliente (no bloquea el registro de jornada). |

## Fuera del sistema (acción del usuario/legal)

- Publicación de las disposiciones generales de la STPS (validar cuando salgan).
- Aviso de privacidad y consentimientos por cliente.
- Política de teletrabajo formal por cliente (el sistema puede generarla/almacenarla).
- Validación con asesor legal antes de prometer “cumple”.

## Criterio de validación final

Cuando cierren los bloques F2-01..F2-04 + marcaje remoto + export STPS + límites 2027,
recorrer esta tabla requisito por requisito y actualizar estado con evidencia
(endpoint/pantalla/prueba), dejando en “pendiente legal” solo lo que depende de la
autoridad o del cliente.

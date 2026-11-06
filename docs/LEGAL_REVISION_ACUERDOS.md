# Paquete de revisión legal — acuerdos de jornada

Fecha: 2026-11-05. Estado: **borrador para revisión con abogado**. No sustituye la validación legal.

## 1. Decisiones del plan §7 y cómo quedaron configurables

| Decisión | Postura inicial implementada | Configuración |
|---|---|---|
| D-1 Representación sindical | Convenio **COLECTIVO** exige parte `UNION`; individual puede aceptar el trabajador | `nom_settings.requireUnionForCollective` (default `true`) |
| D-2 Reloj vs remoto el mismo día | Gana el reloj; el remoto se marca como `REMOTE_CONFLICT` y no duplica minutos | fijo por diseño; flag `remoteCountsForWorkday` controla el remoto sin reloj |
| D-3 Firma del patrón | Usuario RH autorizado + hash SHA-256 + IP + fecha, ligado a la versión | pendiente validar si se exige documento/e.firma adjunto |
| D-4 Checada web sin acuerdo | Bloqueada por defecto hasta aceptar un acuerdo con método `REMOTE` | `nom_settings.blockRemoteWithoutAgreement` (default `true`) |
| D-5 Formato del export | Layout propio versionado `stps-registro-jornada-v2` hasta que publique la STPS | ver [STPS_ADAPTACION.md](STPS_ADAPTACION.md) |

## 2. Textos a validar

### 2.1 Acuerdo de método de registro (trabajador ↔ patrón)

Texto vigente que devuelve `GET /nom/me/record-agreement/proposal`:

> Acuerdo de método de registro de jornada. El registro se lleva con los métodos
> marcados; las correcciones se hacen por ajuste documentado y aprobado, con hora
> del servidor. Ambas partes (trabajador y patrón) conservan una copia y pueden
> consultar el historial.

Métodos disponibles: `CLOCK` (reloj), `REMOTE` (web/app), `ACCESS` (control de acceso).
Política de redondeo: «Minutos exactos; el redondeo es solo para nómina».
Reglas de corrección: «Toda corrección pasa por ajuste documentado y aprobado».
Evidencia: hash SHA-256 del texto+métodos+versión+fecha, aceptación del trabajador y firma del patrón.

**Preguntas al abogado**

1. ¿El texto cubre los requisitos de prueba plena del art. 132 fr. XXXIV?
2. ¿La firma del patrón con usuario RH + hash/IP es suficiente o se requiere e.firma/documento firmado?
3. ¿Se debe entregar copia al trabajador? ¿En qué medio queda constancia?
4. ¿Los métodos `ACCESS` y `REMOTE` requieren consentimiento adicional (biometría, geolocalización)?

### 2.2 Convenio de distribución de jornada (art. 58)

Datos que captura el sistema: persona u horario, tipo (individual/colectivo), parte que acepta
(trabajador/sindicato), vigencia, evidencia textual y aceptación con hash/IP.

**Preguntas al abogado**

1. ¿Basta la aceptación individual o se requiere sindicato cuando existe contrato colectivo?
2. ¿Qué debe contener la evidencia del convenio (acta, firmas, asamblea)?
3. ¿La distribución puede incluir días de hasta 12 h sin rebasar el promedio semanal?
4. ¿Cómo se documenta el cambio a 46 h de 2027 y su vigencia?

## 3. Lo que el sistema ya garantiza (evidencia)

- Checadas inmutables por trigger; ajustes con aprobador distinto y auditoría.
- Ajustes aprobados (reloj o web) modifican jornada, prenómina y export.
- Versiones append-only del acuerdo de método; se reconstruye qué texto aceptó cada parte.
- Historial de verificaciones y cierres de prenómina con snapshot firmado.
- Export con SHA-256 sobre el texto final y detalle de marcajes.
- Retención con piso legal y archivo auditable.

## 4. Entregables para el abogado

- [ ] Texto del acuerdo de método (incluido arriba).
- [ ] Plantilla de convenio art. 58 (evidencia y aceptación).
- [ ] Ejemplo de export v2 con hash (`GET /nom/export/stps?...`).
- [ ] Matriz de decisiones §1 y configuración por cliente.
- [ ] Contrato de confidencialidad/encargo de tratamiento de datos (si aplica).

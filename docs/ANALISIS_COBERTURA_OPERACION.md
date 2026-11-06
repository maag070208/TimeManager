# Cobertura operativa: retardos, turnos, vacaciones, prenómina y checada web

Fecha: 2026-11-05. Estado: **análisis de cobertura** (no todo está implementado).
Complementa a [PLAN_CUMPLIMIENTO_JORNADA.md](PLAN_CUMPLIMIENTO_JORNADA.md) (plan legal) y a
[modules/nom.md](modules/nom.md) / [modules/schedules.md](modules/schedules.md) (fichas técnicas).

> Este documento responde a una pregunta de negocio: **¿qué tanto cubrimos hoy y qué falta para
> operar distintas industrias?** Las estimaciones de cobertura son cualitativas y sirven para
> priorizar, no como certificación legal. Los puntos de derecho laboral deben validarse con asesor.

---

## 1. Resumen ejecutivo

Hoy el sistema cubre bien **registro de asistencia, horarios, retardos, horas extra legales y
evidencia auditable**. Lo que falta para ser un sistema de nómina completo es, sobre todo,
**administración de vacaciones/permisos, tarifas de pago (descanso, festivo, domingo), nómina con
percepciones/deducciones y reglas configurables por industria**.

| Área | Cobertura | Lectura corta |
|---|---:|---|
| Retardos | **70 %** | Se calculan y reportan; no generan sanción ni impacto de pago porque no hay motor de nómina |
| Retardos configurables | **50 %** | Tolerancias por horario; faltan reglas por cliente/industria y consecuencias |
| Jornada 9:00–22:00 | **70 %** | Jornada diaria topada a 8/7/7.5 h; exceso diario como extra y tope 12 h (RJ-08) |
| Obrero-patronal | **55 %** | Auditoría, ajustes y retención sí; faltan contratos/consentimientos y expediente laboral completo |
| “Checa entrada, se hace wei y sale con extra” | **35 %** | Hay reloj + aprobación + ledger, pero no pausas, geocerca ni autorización previa |
| Vacaciones pagadas | **70 %** | Implementadas: tipos, saldo LFT, solicitud y aprobación (2026-11-05) |
| Vacaciones no pagadas | **70 %** | Permiso sin goce con el mismo flujo |
| Día de descanso pagado | **20 %** | Se marca descanso trabajado/domingo; no hay tarifa ni pago |
| Día de descanso no pagado | **40 %** | `restDay` + faltantes detectados; falta justificación/incidencia |
| Multi-industria | **40 %** | Horarios flexibles, partidos y cruce de medianoche; faltan patrones rotativos y plantillas |
| Turno 22:00–05:00 | **60 %** | `crossesMidnight` + tipo nocturna; faltan pruebas de nómina y pago nocturno |
| Pleitos legales | **60 %** | Append-only, auditoría, ajustes con aprobación, ledger semanal y retención; faltan consentimientos/UI y registro exacto |
| Dobles/triples configurables | **55 %** | Motor legal fijo por año; el cliente solo puede endurecer, no hay motor de pago |
| Prenómina “completita” | **35 %** | Asistencia + extra aprobado + cierre semanal; **no** hay salarios, deducciones ni CFDI |
| Checada desde la web | **45 %** | Existe captura con modalidad y GPS opcional; **no** entra a asistencia/prenómina |

**Conclusión:** para demo operativa se ve completa; para vender “nómina completa” faltan dos bloques:
**(A) reglas de pago/configuración por industria** y **(B) vacaciones/permisos + motor de nómina**.

---

## 2. Caso por caso

### 2.1 Retardos

**Hoy:** `computeWorkday` calcula `lateMin` comparando la primera entrada contra `startTime` y la
tolerancia del horario (`entryToleranceMin`); sólo marca retardo si supera la tolerancia
(`api/src/modules/schedules/services/workday-rules.ts`). El reporte semanal de asistencia y la
pre-nómina muestran minutos de retardo, faltantes y ausencias. La tolerancia se configura **por
horario**, no por cliente ni por tipo de persona.

**Lo que falta:**

- Regla de retardo por **cliente/industria** (minutos de gracia, redondeo, si acumula falta).
- Consecuencias configurables (descuento, amonestación, acumulación para acta) — hoy no hay módulo
  disciplinario conectado al retardo, sólo el reporte `DisciplinaryReport` genérico.
- Retardo de **salida temprana**: hoy no se penaliza; sólo suma faltante (`missingMin`).
- Tolerancia distinta por día/turno (ej. lunes vs. turno nocturno).

### 2.2 Jornada 9:00–22:00 (13 h)

**Hoy:** la validación H-02 rechaza al crear/editar un horario si la **semana** pasa del tope legal
del año o si no hay descanso; también avisa (no bloquea) si un día pasa del estándar del turno. En
cálculo, el día 9–22 se toma como **jornada programada completa** (13 h): el extra sólo se cuenta
después de la salida programada, y el ledger semanal marca el exceso sobre 12 h sólo cuando hay
minutos extra que sobrepasen ese tope.

**Problema legal:** el art. 61 fija 8 h diurnas / 7 nocturnas / 7.5 mixtas; una jornada ordinaria
de 13 h no es legal sin convenio del art. 58, y el art. 68 impide pasar de 12 h ordinaria + extra.
Hoy no se separa automáticamente “8 h ordinarias + 5 h extra” en el día; se considera todo
ordinario hasta la salida programada.

**Lo que falta:** regla diaria de jornada máxima por tipo de turno (8/7/7.5), convenio art. 58 por
persona/horario, y desglose diario ordinaria vs. extra antes de llegar a la semana. Es el punto que
más impacta tanto la prenómina como el reporte de inspección.

### 2.3 Tema obrero-patronal

**Hoy:** hay roles y permisos, auditoría de acciones, checadas append-only, ajustes de checada con
aprobación y motivo, ledger semanal de horas extra, retención con piso legal (en curso) y catálogo
de festivos. El backend de **acuerdo del método de registro** y **conformidad periódica** del
trabajador ya existe (R-01).

**Lo que falta:**

- UI para que el trabajador firme/acepte desde Mi jornada (hoy sólo API).
- Expediente laboral completo: contratos, puestos, salario, vacaciones, permisos, actas.
- Autorización **previa** del patrón y consentimiento del trabajador para horas extra (modelo
  `OvertimeRequest`, pendiente en el plan).
- Convenios colectivos / reglamento interior con reglas que el motor pueda aplicar.
- Registro exacto de minutos sin tolerancias/minimos (hoy `exitToleranceMin` y `minOvertimeMin`
  pueden ocultar tiempo; el plan lo tiene como brecha 1.6).

### 2.4 “Checa entrada, se hace wei y checa salida con horas extra”

**Hoy:** si la salida es después de la hora programada, el sistema calcula extra desde la salida,
aunque en medio no haya trabajado. Hay reloj físico + aprobación diaria de extra + ledger semanal,
pero **no hay control de pausas** (entrada/salida de comida o salidas temporales), ni geocerca, ni
evidencia de que la persona estuvo en el sitio. Con checada web (GPS opcional) tampoco hay
validación de que el punto esté dentro de una zona.

**Mitigaciones actuales:** ajuste de checada documentado, aprobación de extra, marcas del reloj
repetidas/entrada sin salida en el reporte, y `PunchAdjustment` auditable.

**Lo que falta:** pausas registradas (R-03), geocerca por sitio para checada web, selfie/evidencia
opcional, autorización previa de extra, y política de “tiempo inactivo” si la persona sale y
regresa (varias sesiones del martes).

### 2.5 Vacaciones pagadas / no pagadas

**Hoy:** existen `leave_types`/`leave_requests` con saldo LFT y aprobación. Se detectan
ausencias por la ausencia de checadas en el reporte semanal, sin justificación ni goce de sueldo.

**Lo que falta (bloque completo):**

- Tipos de incidencia configurables: vacaciones (pagadas), permiso con goce, permiso sin goce,
  incapacidad, falta injustificada, descanso pagado/no pagado.
- Saldo de vacaciones conforme LFT art. 76 (12 días primer año, +2 por año hasta 20, luego +2 cada
  5 años) con antigüedad por `hireDate`.
- Solicitud/aprobación, calendario, comprobante y reflejo en prenómina (percepción o descuento).
- Vacaciones no pagadas: mismo flujo con regla de descuento.

### 2.6 Día de descanso pagado / no pagado

**Hoy:** `restDay` en horario, y el motor semanal separa `restDayWorkedMin` y marca `sundayWorked`;
también hay catálogo de festivos (`Holiday`) con siembra de los obligatorios. Pero **no se calcula
pago**: no hay tarifa de prima dominical (25 %), ni pago doble por descanso/festivo laborado, ni
distinción configurable entre descanso pagado y no pagado.

**Lo que falta:** reglas de pago por concepto (`rest_day`, `holiday`, `sunday_premium`) con
multiplicadores legales mínimos, y que la prenómina los consuma. El ledger ya trae las bolsas; falta
el motor de precios.

### 2.7 Perspectiva multi-industria y configuración

**Hoy:** horarios con tolerancias, comida, mínimo de extra, turno partido, cruce de medianoche y
asignaciones con vigencia. El motor semanal es legal (no arbitrario). El cliente sólo puede
configurar límites **más estrictos** que la ley, no más laxos.

**Lo que falta para industrias** (hotelería, seguridad, maquila, salud, comercio):

- Patrones rotativos (2×2×3, 4×3, guardias 24 h) y calendario de asignaciones por ciclo, no sólo
  semana fija.
- Plantillas de política por industria (tolerancias, pausas, redondeo, autorización de extra,
  checada web permitida o no).
- Multiempleador/sucursal y reglas por sitio (geocerca, reloj, zona horaria).
- Reglas de pago configurables dentro del piso legal (p. ej. doble/triple no pueden bajar de ley,
  pero sí pueden mejorar por contrato).
- Festivos por estado/industria y días de descanso obligatorios variables.

### 2.8 Turno 22:00–05:00

**Hoy:** `crossesMidnight` existe; el tipo de turno se calcula (nocturna) y el motor usa 7 h como
máximo diario sin convenio. Los reportes atribuyen la sesión al día de entrada y detectan cruce de
medianoche. El ledger semanal aplica la tabla nocturna cuando el horario lo declara.

**Riesgo/lo que falta:** validar con pruebas de nómina el caso 22:00–05:00 (7 h), el extra después
de las 05:00, la atribución al día/semana correcta y el pago de prima nocturna si el contrato la
pacta. Falta también el patrón recurrente de guardias nocturnas.

### 2.9 Pleitos legales / carga de la prueba

**Hoy:** checadas append-only, ajustes con aprobación y auditoría, ledger semanal firmado por hash,
export STPS con bolsas, retención con piso legal, acuerdo de método y conformidad (backend).

**Lo que falta para reducir riesgo:**

- Registro exacto sin tolerancias (brecha 1.6): hoy se restan tolerancias de salida y se descarta
  extra menor al mínimo del horario, lo que puede ocultar tiempo trabajado.
- UI del acuerdo/conformidad y firma del trabajador.
- Autorización previa + consentimiento de extra (1.5) y bloqueo de menores.
- Retención ligada a la baja + 1 año y lectura de archivos en el export (R-02, en curso).
- Expediente de vacaciones/permisos/actas para acreditar condiciones.
- Bitácora de quién cambió qué y por qué (ya hay auditoría; falta vista de “paquete de inspección”).

### 2.10 Dobles/triples configurables

**Hoy:** la ley se aplica por año (9/10/11/12 h al doble; 4 h al triple; 4 h/día, 4 días). El motor
está en código y el cliente sólo puede endurecer la jornada (más estricto), nunca pagar menos.
La aprobación diaria y el ledger semanal ya existen.

**Lo que falta:** motor de **pago** que traduzca doble/triple a importes (salario/hora, factor,
redondeo de nómina), y una tabla de política de pago por cliente con piso legal. Hoy el export
entrega minutos, no dinero.

### 2.11 Prenómina “completita”

**Hoy:** reporte semanal de asistencia por departamento, retardos/faltantes/ausencias, aprobación de
horas extra, cierre/reapertura de la semana por departamento, snapshot del cierre, PDF/CSV y export
STPS v1. Es una **pre-nómina de asistencia**, no una nómina.

**Lo que falta para nómina completa:**

- Salario base, sueldo diario/hora, prestaciones y factor de integración.
- Percepciones: ordinaria, extra doble/triple, prima dominical, festivo/descanso laborado,
  vacaciones, prima vacacional, aguinaldo (provisión).
- Deducciones: IMSS, ISR, infonavit, préstamos, faltas, permisos sin goce.
- Cálculo por periodo (semanal/quincenal/mensual), CFDI/recibos y timbrado (fuera de alcance actual).
- Cierre contable y conciliación con el reporte de asistencia.

Cobertura realista de un sistema de nómina completo: **~35 %** (todo lo de asistencia y evidencia,
nada de cálculo fiscal).

### 2.12 Checada desde la web

**Hoy:** portal Mi jornada con marcaje remoto (`RemotePunch`): entrada/salida, modalidad
PRESENCIAL/HIBRIDO/REMOTO/CAMPO, GPS **opcional sólo al marcar**, nota e idempotencia. Se puede
habilitar/deshabilitar por cliente. También existe checada por reloj y eventos de acceso.

**Brechas:**

- El marcaje web **no alimenta** el reporte de asistencia ni la prenómina ni el ledger semanal:
  vive en `remote_punches` y sólo el export STPS lo lista en una sección aparte.
- No tiene geocerca, selfie, validación de dispositivo ni vínculo con el horario del día.
- Si se usa “PRESENCIAL” desde la web, el sistema no lo distingue de una checada remota.
- Falta política de aprobación cuando no hay reloj o cuando cae fuera de horario.

**Prioridad:** integrar `RemotePunch` al cálculo de jornada (misma pareja entrada/salida que el
reloj) y aplicar geocerca por sitio. Es lo que convierte “checada web” en registro formal.

---

## 3. Modelo de configuración propuesto

Para que sea multi-industria sin volverlo inmanejable, separar **política** (configurable) de
**motor legal** (fijo por año):

1. **`AttendancePolicy` (por cliente, opcional por sitio):** tolerancia de entrada/salida,
   redondeo de registro (nunca para el registro legal, sí para pago), salida temprana, pausas
   obligatorias, cierre automático de checadas abiertas, días de descanso, checada web permitida.
2. **`ShiftPattern`:** horario semanal, cíclico (2×2×3, guardias), turno partido, cruce de
   medianoche, tipo de turno calculado, vigencia por asignación.
3. **`OvertimePolicy`:** autorización previa, consentimiento del trabajador, topes (ley + más
   estricto), política de pago (redondeo/minutos mínimos sólo para nómina), multiplicadores legales
   mínimos (doble/triple), regla de “tiempo inactivo”.
4. **`LeavePolicy`:** tipos de incidencia (vacaciones pagadas/no pagadas, permiso con/sin goce,
   incapacidad, falta), saldos, antigüedad, aprobación, goce de sueldo.
5. **`PayRule`:** conceptos y tarifas (ordinaria, extra, prima dominical 25 %, festivo/descanso
   laborado, vacaciones, prima vacacional), piso legal y override contractual permitido.
6. **`WebPunchPolicy`:** modalidades, geocerca por sitio, selfie/evidencia, horario permitido,
   aprobación si está fuera de rango.
7. **Plantillas por industria:** conjuntos de las políticas anteriores aplicables a hotelería,
   seguridad, maquila, salud, comercio; el cliente puede copiar y ajustar.

---

## 4. Qué sigue (prioridad sugerida)

| Prioridad | Qué | Por qué |
|---|---|---|
| **P0** | Integrar checada web al cálculo de jornada y prenómina | Sin esto, la checada web no es registro formal |
| **P0** | Regla diaria 8/7/7.5 + convenio art. 58 y desglose diario ordinaria/extra | Caso 9–22 y turnos nocturnos; riesgo de inspección |
| **P0** | Registro exacto sin tolerancias (brecha 1.6) y autorización/consentimiento de extra (1.5) | Carga de la prueba y “hacerse wei” |
| **P0** | Vacaciones/permisos con saldo y goce de sueldo | Bloquea cualquier nómina real |
| **P1** | Motor de pago (doble/triple, domingo, festivo, descanso, vacaciones) y prenómina con percepciones | “Prenómina completita” |
| **P1** | Patrones rotativos y plantillas por industria | Multi-industria de verdad |
| **P1** | Geocerca y evidencias de checada web | Anti-fraude |
| **P2** | Deducciones/IMSS/ISR/CFDI y cierre contable | Nómina fiscal completa |
| **P2** | Expediente de inspección y actas disciplinarias conectadas a retardos | Litigios |

**Atajo comercial:** para la demo actual, lo que ya se ve (asistencia, retardos, horas extra, turnos,
export y evidencia) es suficiente para mostrar operación; para vender “cumple nómina completa” hay
que cerrar P0 y P1 del cuadro.

---

## 5. Decisiones que necesitamos del negocio/asesor

1. ¿La jornada 9–22 se considera ordinaria pactada (convenio art. 58) o debe partirse en 8 h
   ordinarias + extra desde la hora 9?
2. ¿Los retardos descuentan nómina, generan acta o ambos? ¿Con qué regla (minutos, fracción,
   acumulación)?
3. ¿Checada web permitida sólo remoto/campo o también presencial con geocerca?
4. ¿Vacaciones y permisos con goce se capturan en CheckLab o se importan de otro sistema?
5. ¿La prenómina debe calcular importes o sólo entregar minutos/incidencias al sistema de nómina
   externo (contador/CFDI)?
6. ¿Qué industrias priorizamos para las plantillas (hotelería, seguridad, maquila, salud)?
7. ¿Política de “tiempo fuera del sitio” durante la jornada: se descuenta, requiere pausa marcada o
   se castiga como falta?
8. ¿Autorización de extra previa obligatoria por contrato o default del cliente?

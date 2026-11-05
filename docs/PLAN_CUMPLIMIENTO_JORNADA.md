# Plan de cumplimiento al 100 %: NOM-037-STPS-2023 + reforma LFT 2026 (jornada, horas extra y registro electrónico)

Fecha: 2026-11-05. Estado: **F0 implementada** y **F1 en curso** (motor semanal + ledger); F2-F6 pendientes.
Complementa a [NOM_CUMPLIMIENTO.md](NOM_CUMPLIMIENTO.md) (estado actual) y a [modules/nom.md](modules/nom.md).

> **Alcance legal.** Este documento es un mapeo técnico de la norma al producto, no una opinión
> legal. Los puntos marcados **[ABIERTA]** son interpretaciones que debe resolver el asesor
> laboral antes de vender "cumple al 100 %". Lo citado como "LFT vigente" son artículos que el
> decreto de 2026 no tocó; verificar su redacción actual antes de cerrar.

---

## 0. Qué regula cada instrumento (y por qué son dos cosas)

| Instrumento | Publicación / vigencia | Qué regula | Qué **no** regula |
|---|---|---|---|
| **NOM-037-STPS-2023** "Teletrabajo – Condiciones de seguridad y salud en el trabajo" ([DOF 5691672](https://dof.gob.mx/nota_detalle_popup.php?codigo=5691672)) | Vigente desde 180 días naturales después de su publicación (2023) | Seguridad y salud de quien teletrabaja (> 40 % de su jornada fuera del centro de trabajo, LFT art. 330-A): listado de teletrabajadores, política, checklist del lugar, ergonomía, capacitación, desconexión, reversibilidad, evidencias | Duración de la jornada, horas extra, registro de asistencia |
| **Decreto de reforma a la LFT "reducción de la jornada laboral"** ([DOF 5786537](https://dof.gob.mx/nota_detalle_popup.php?codigo=5786537), 01-may-2026) | En vigor el 01-may-2026; disposiciones STPS del registro electrónico desde el 01-ene-2027 | Arts. 58, 59, 61, 66, 67, 68, 69, 71, 132 fr. XXXIV, 994 fr. IV Bis: jornada de 40 h gradual, **horas extra**, descanso, prima dominical y **registro electrónico de jornada** | Teletrabajo (eso es la NOM-037 y el capítulo XII Bis de la LFT) |

**"Cumplir la NOM-037" que pide el mercado = las dos cosas.** El sistema debe cubrir ambas.

### 0.1 Texto del decreto LFT 2026 que gobierna el diseño (literal, DOF 5786537)

- **Art. 58, 2.º párr.:** la jornada "podrá ser distribuida de común acuerdo por las personas empleadoras y trabajadoras".
- **Art. 59:** "La duración máxima de la jornada ordinaria de trabajo será de cuarenta horas semanales."
- **Art. 61:** "ocho horas la diurna, siete la nocturna y siete horas y media la mixta".
- **Art. 66:** horas extra por circunstancias extraordinarias, pagadas con "un cien por ciento más" (doble). "El trabajo extraordinario no excederá de doce horas en una semana, las cuales podrán distribuirse en hasta cuatro horas diarias, en un máximo de cuatro días en ese periodo."
- **Art. 67, 2.º párr.:** derogado.
- **Art. 68:** el trabajador no está obligado a laborar más de lo permitido. La prolongación que supere el art. 66 "no podrá ser mayor de cuatro horas a la semana" y se paga con "un doscientos por ciento más" (triple). "La suma de las jornadas ordinaria y extraordinaria, en ningún caso podrá ser mayor a doce horas diarias."
- **Art. 69:** por cada seis días de trabajo, al menos un día de descanso con goce de salario íntegro.
- **Art. 71, 2.º párr.:** prima dominical de al menos 25 %.
- **Art. 132 fr. XXXIV:** "Registrar de manera electrónica la jornada laboral de cada persona trabajadora, incluyendo el horario de inicio y finalización; así como proporcionarlo a la autoridad cuando se le requiera." La STPS "expedirá las disposiciones de carácter general" (ámbito y excepciones). El registro "hará **prueba plena** si se acredita que fue acordado entre la persona trabajadora y empleadora".
- **Art. 994 fr. IV Bis:** multa de 250 a 5,000 UMA por no llevar el registro.
- **Transitorios:** 2.º jornada semanal **48 (2026) → 46 (2027) → 44 (2028) → 42 (2029) → 40 (2030)**, cada escalón desde el 1 de enero; 3.º periodo de ajuste 01-may a 31-dic-2026; 4.º horas extra semanales **9 (2026) → 9 (2027) → 10 (2028) → 11 (2029) → 12 (2030)**; 5.º disposiciones STPS del registro desde el 01-ene-2027; 7.º la reducción no puede disminuir salarios ni prestaciones.

### 0.2 LFT vigente que también aplica (no la tocó el decreto; verificar redacción)

| Art. | Regla | Impacto en el sistema |
|---|---|---|
| 60 | Diurna 6:00–20:00; nocturna 20:00–6:00; mixta = abarca ambos con menos de 3.5 h nocturnas | Clasificar cada turno para saber su jornada diaria legal (8 / 7 / 7.5) |
| 63–64 | Descanso de al menos media hora en jornada continua; si no puede salir, cuenta como tiempo efectivo | Validar horarios; no descontar comida si el trabajador no sale |
| 73 | Trabajo en día de descanso: salario doble adicional | Bolsa separada "descanso laborado" |
| 74–75 | Días de descanso obligatorio; si se labora, salario doble adicional | Catálogo de festivos y bolsa "festivo laborado" |
| 170 | Lactancia: dos reposos de 30 min o reducir 1 h la jornada (hasta 6 meses) | Ajuste de jornada programada sin generar faltante ni retardo |
| 178 | Menores de 18: prohibidas las horas extra y el trabajo en domingo/descanso obligatorio; si ocurre, se paga con 200 % más | Bloqueo y alerta por edad (`User.birthDate`) |
| 330-A a 330-K | Teletrabajo (> 40 % de la jornada) | Umbral de aplicación de la NOM-037 |
| 784 / 804 | Carga de la prueba de la jornada en el patrón; conservar controles de asistencia durante el último año de la relación y un año después de terminada | Retención basada en la fecha de baja, no solo en meses desde el marcaje |

---

## 1. Horas extra: reglas que el sistema debe aplicar

Esta es la parte con más riesgo. Hoy el sistema calcula el tiempo extra **por día contra el horario**
y lo aprueba por día. La ley lo mide **por semana, con topes diarios, de días y de excedente, y con
dos tasas de pago**. Hay que construir un motor semanal.

### 1.1 Tabla legal por año (en código, no en configuración)

| Año (desde 1-ene) | Jornada ordinaria semanal máx. | Extra al doble (tope semanal) | Extra al triple (excedente art. 68) | Máx. extra por día | Máx. días con extra | Total diario (ordinaria + extra) |
|---|---|---|---|---|---|---|
| 2026 | 48 h | 9 h | hasta 4 h | 4 h | 4 | 12 h |
| 2027 | 46 h | 9 h | hasta 4 h | 4 h | 4 | 12 h |
| 2028 | 44 h | 10 h | hasta 4 h | 4 h | 4 | 12 h |
| 2029 | 42 h | 11 h | hasta 4 h | 4 h | 4 | 12 h |
| 2030+ | 40 h | 12 h | hasta 4 h | 4 h | 4 | 12 h |

**Lo que ya está mal hoy y se corrige primero (P0):** `weeklyLimitForYear` en
`api/src/modules/nom/services/nom-settings.service.ts` devuelve **46 h para 2027-2029**; el
transitorio segundo dice 46/44/42. Además el barrido de alertas (`workday-alerts.service.ts`)
compara las horas **trabajadas** contra ese tope ordinario. Eso marca como infracción a cualquiera
con horas extra legales. El tope de infracción real es *ordinaria + extra doble + 4 h triple*, o
romper alguna de las reglas de la sección 1.3.

### 1.2 Definiciones operativas

- **Semana de cálculo:** la semana de nómina del cliente (configurable: día de inicio). El tope se
  toma del año al que pertenece cada día. **[ABIERTA]** Una semana que cruza el 1 de enero (p. ej. 29-dic-2026 a 4-ene-2027): ¿tope prorrateado, el del año de inicio o el más favorable al trabajador? Recomendación: el más favorable al trabajador (el tope ordinario menor del nuevo año).
- **Jornada pactada del día:** la del horario asignado (`ScheduleDay`), menos lactancia. Si existe un
  **convenio de distribución** (art. 58) registrado, el día puede pasar de 8/7/7.5 h siempre que la
  semana respete el art. 59. Sin convenio, lo que pase del máximo diario del art. 61 por tipo de turno es extra.
- **Tiempo efectivo:** de la entrada a la salida, menos pausas en las que el trabajador sí pudo
  salir (art. 64). La comida descontada por el horario (`mealBreakMin`) solo se resta si hubo marcaje
  de salida o si el horario la declara como "fuera del centro".
- **Candidato a extra del día:** tiempo efectivo por encima de la jornada pactada del día, sumando
  lo trabajado **antes** de la entrada programada (hoy solo se cuenta después de la salida) cuando la
  política del cliente lo indique o cuando exista autorización.
- **Reclasificación semanal:** si la suma ordinaria de la semana rebasa el máximo del art. 59 para el
  año (p. ej. un horario de 48 h en 2027), el exceso se vuelve extra aunque estuviera "programado".
  Se toma de los últimos días de la semana.
- **Descanso laborado y festivo laborado:** bolsas separadas (art. 73 / 75), no se mezclan con el
  tope de extra. **[ABIERTA]** Si en un descanso se trabaja más que una jornada, ¿el exceso es además extra? Recomendación: sí, el exceso sobre la jornada del día cuenta contra los topes de art. 66.
- **Domingo trabajado:** marca de prima dominical 25 % (art. 71), sea o no extra.

### 1.3 Algoritmo de clasificación (por persona y semana)

Entrada: días de la semana con tiempo efectivo, jornada pactada, tipo de turno, descanso/festivo, edad y año.

1. **Por día:** `extraDia = max(0, efectivo − jornadaPactada)` (con convenio art. 58) o contra el máximo del art. 61.
2. **Reclasificación semanal (art. 59):** si `Σ ordinaria > maxOrdinariaAño`, mover el excedente a `extraDia` empezando por el último día trabajado.
3. **Recorrer los minutos extra en orden cronológico** y asignar cada uno a una bolsa:
   - **DOBLE** (100 % adicional) mientras se cumpla todo: acumulado semanal doble < tope del año (9/10/11/12 h), extra de ese día ≤ 4 h y el día está entre los **primeros 4 días con extra** de la semana.
   - **TRIPLE** (200 % adicional) cuando cualquiera de esas tres condiciones se rompe, hasta **4 h por semana** (art. 68).
   - **EXCEDENTE_ILEGAL** cuando ya se agotaron las 4 h triples. Se paga al triple igual (no puede quedar sin pagar) y genera **infracción**.
4. **Tope diario de 12 h (art. 68):** si `ordinaria + extra > 12 h` en un día, el excedente sobre 12 h va a `EXCEDENTE_ILEGAL` y genera infracción.
5. **Menores de 18 (art. 178):** todo minuto extra va a TRIPLE con la marca `MENOR`. También se marca infracción, igual que trabajar en domingo o festivo.
6. **Descanso (art. 69):** si hay 7 días seguidos con marcaje (cruzando semanas), se genera infracción `SIN_DIA_DE_DESCANSO`.
7. Se guarda un **snapshot inmutable** con la versión del motor (`otEngineVersion`) y el detalle día por día.

**[ABIERTA] (la principal):** el art. 68 limita a 4 h lo que "supere lo establecido en el art. 66". El texto no dice si en 2026-2029 se mide contra el tope transitorio (9/10/11) o contra las 12 h del art. 66. Recomendación: contra el **tope transitorio del año**, porque es el que está vigente y protege más al trabajador. Debe ser una constante del motor, fácil de cambiar si el asesor opina otra cosa.

**[ABIERTA]:** cuando se rompen el 5.º día o las 4 h diarias, ¿es triple (art. 68) o es infracción directa? Recomendación: triple dentro de las 4 h semanales y luego infracción, como en el paso 3.

### 1.4 Casos de prueba obligatorios (unitarios del motor)

| # | Año | Escenario | Resultado esperado |
|---|---|---|---|
| 1 | 2027 | Horario 46 h, 3 días con 2 h extra | 6 h DOBLE |
| 2 | 2027 | 4 días con 3 h extra (12 h) | 9 h DOBLE + 3 h TRIPLE |
| 3 | 2027 | 4 días con 4 h extra (16 h) | 9 h DOBLE + 4 h TRIPLE + 3 h EXCEDENTE_ILEGAL + infracción |
| 4 | 2027 | 5 días con 1 h extra | 4 h DOBLE + 1 h TRIPLE (5.º día) |
| 5 | 2027 | Jornada pactada de 6 h y 5 h extra en un día (11 h) | 4 h DOBLE + 1 h TRIPLE (tope diario de 4 h) |
| 6 | 2027 | Horario de 48 h sin extra marcada | 2 h DOBLE por reclasificación del art. 59 + alerta "horario ilegal 2027" |
| 7 | 2028 | Igual que el 2 | 10 h DOBLE + 2 h TRIPLE |
| 8 | 2030 | 4 días con 4 h extra | 12 h DOBLE + 4 h TRIPLE |
| 9 | 2027 | Jornada de 8 h + 5 h extra en un día (13 h) | 4 h DOBLE + 1 h EXCEDENTE_ILEGAL (pasa de 12 h diarias) + infracción |
| 10 | 2027 | Trabajador de 17 años con 1 h extra | 1 h TRIPLE `MENOR` + infracción |
| 11 | 2027 | Turno nocturno 22:00–06:00 (8 h) sin convenio | 1 h extra diaria (nocturna = 7 h) |
| 12 | 2027 | Igual que el 11, con convenio art. 58 y semana ≤ 46 h | 0 extra |
| 13 | 2027 | Trabaja su día de descanso 8 h | 8 h DESCANSO_LABORADO (no consume el tope de extra) |
| 14 | 2027 | Trabaja domingo | marca prima dominical 25 % |
| 15 | 2027 | Semana 29-dic-2026 a 4-ene-2027 | tope según la decisión de la [ABIERTA] 1.2 |
| 16 | 2027 | 7 días seguidos con marcaje | infracción SIN_DIA_DE_DESCANSO |
| 17 | 2027 | Lactancia con reducción de 1 h | jornada pactada −60 min, sin faltante ni retardo |
| 18 | 2027 | Salida 25 min después con `minOvertimeMin = 60` | Registro: 25 min extra registrados; el redondeo de nómina aparte (ver 1.6) |

### 1.5 Autorización, consentimiento y aprobación

- **Autorización previa (art. 66, "circunstancias extraordinarias"):** solicitud de extra por jefe/RH
  con motivo, días y horas estimadas. El motor **advierte antes de autorizar** si la solicitud rompe
  cualquier tope (proyección con lo ya trabajado en la semana).
- **Consentimiento del trabajador (art. 68, 1.er párr.):** el trabajador acepta o rechaza la solicitud
  desde `/mi-jornada`. Rechazarla no puede generar sanción ni retardo. Para menores, la solicitud se bloquea.
- **Aprobación posterior (lo que hoy hace `OvertimeApproval`):** pasa a ser **reconocimiento para
  pago**. Un rechazo **no borra** el tiempo del registro ni del export STPS (el registro refleja lo
  trabajado). Si el tiempo no se trabajó realmente, se corrige con un ajuste de checada documentado
  (`PunchAdjustment`). **[ABIERTA]** Tratamiento de extra trabajado sin orden del patrón; recomendación: se registra siempre y nómina lo paga salvo ajuste documentado.
- La aprobación se hace **por semana clasificada** (bolsas DOBLE/TRIPLE/EXCEDENTE), no por día suelto.
- Infracciones (`EXCEDENTE_ILEGAL`, 12 h, menor, sin descanso) no se pueden "aprobar". Se reconocen para pago y quedan en el informe de cumplimiento.

### 1.6 Tolerancias y redondeos

Hoy `computeWorkday` resta `exitToleranceMin` (10) al extra y descarta extra menor a
`minOvertimeMin` (60 por defecto). Para el **registro** eso es riesgoso: oculta tiempo trabajado
y en juicio la carga de la prueba es del patrón (art. 784).

- El **registro y el export STPS** guardan minutos exactos, sin tolerancias.
- Las tolerancias y mínimos pasan a ser **política de pago** del cliente, visibles, versionadas y
  auditadas, aplicadas solo en la pre-nómina. **[ABIERTA]** si un mínimo de 60 min es defendible. Recomendación: default `minOvertimeMin = 0` en clientes nuevos y aviso en los existentes.

### 1.7 Configuración por cliente: solo más estricto que la ley

Hoy `nom_settings` acepta topes hasta 24 h/día y 7 días/semana. La regla nueva: el cliente puede
configurar topes **más estrictos** (p. ej. contrato colectivo con 40 h ya en 2027), nunca más
laxos. Validación en `PUT /nom/config`: `valor ≤ tope legal del año`.

---

## 2. Registro electrónico de jornada (art. 132 fr. XXXIV)

Estado actual: cubierto en lo técnico (ver [NOM_CUMPLIMIENTO.md](NOM_CUMPLIMIENTO.md)). Brechas:

| ID | Brecha | Qué construir | Prioridad |
|---|---|---|---|
| R-01 | **Prueba plena:** el registro solo hace prueba plena "si se acredita que fue acordado" | (a) **Acuerdo del método de registro** por trabajador: documento versionado (reloj, remoto, reglas de redondeo, cómo corregir), aceptado con fecha/IP/versión. (b) **Conformidad periódica**: al cierre de cada semana o quincena el trabajador ve su resumen (ordinaria, extra doble/triple, descansos) y lo acepta o abre discrepancia. Se guarda el hash del resumen aceptado | P0 |
| R-02 | Retención art. 804 | Retención mínima = **último año de la relación + 1 año tras la baja** (necesita fecha de baja en `User`). El archivado actual por meses desde el marcaje no debe archivar registros dentro de esa ventana. El export STPS debe leer también las tablas `nom_archived_*` | P0 |
| R-03 | Pausas y descansos | Registrar inicio/fin de pausa cuando el trabajador sale (art. 64) en reloj y remoto, para que el tiempo efectivo sea demostrable | P1 |
| R-04 | Export STPS con horas extra clasificadas | Añadir columnas: ordinaria, extra doble, extra triple, excedente ilegal, descanso laborado, festivo laborado, domingo, menor, infracciones. Subir layout a `stps-registro-jornada-v1` | P0 |
| R-05 | Integridad | Sello encadenado por lote (hash del lote anterior + lote actual) y firma del export; verificación pública por hash | P1 |
| R-06 | Disposiciones STPS (01-ene-2027) | Vigilancia del DOF; al publicarse: ajustar ámbito/excepciones, formato y retención en ≤ 30 días. Mantener el layout versionado | Continuo |
| R-07 | Corrección de marcaje remoto | `PunchAdjustment` polimórfico (reloj y remoto) para que todo marcaje tenga el mismo flujo de corrección | P1 |
| R-08 | Requerimiento de la autoridad | Botón "Paquete para inspección": export STPS + bitácora de ajustes + acuerdos y conformidades + infracciones, en ZIP con hashes | P1 |

## 3. Horarios y jornada (arts. 58–61, 63, 69, 170)

| ID | Qué construir | Prioridad |
|---|---|---|
| H-01 | Tipo de turno calculado (diurna/nocturna/mixta) por art. 60 a partir de las horas de `ScheduleDay`; mostrarlo en el horario | P0 |
| H-02 | Validación de horario: semana ordinaria ≤ máximo del año de vigencia, ≥ 1 día de descanso por cada 6, media hora de descanso en jornada continua. Si no cumple, no se guarda (o se guarda solo con convenio art. 58 cuando aplique) | P0 |
| H-03 | **Asistente de transición 2027–2030:** reporte de horarios y asignaciones que dejan de ser legales el 1-ene de cada año, con propuesta de horario ajustado y aviso a RH 60 y 30 días antes. Recordatorio: sin reducir salario (transitorio 7.º) | P0 |
| H-04 | Convenio de distribución de jornada (art. 58) por trabajador o por horario: documento versionado y aceptado por el trabajador | P1 |
| H-05 | Catálogo de festivos (art. 74) por cliente y año, sembrado con los obligatorios | P0 |
| H-06 | Periodos de lactancia (art. 170): modalidad (2×30 min o −1 h), vigencia ≤ 6 meses | P1 |
| H-07 | Alerta de 7 días seguidos trabajados (art. 69) | P0 |

## 4. NOM-037 teletrabajo: brechas contra la norma

Implementado hoy: registro de teletrabajadores, política/desconexión/aviso versionados con
consentimiento, checklist de 8 puntos (autollenado), registro de contactos fuera de horario.

| Numeral | Requisito | Brecha / qué construir | Prioridad |
|---|---|---|---|
| 5.1 | Listado actualizado con nombre, género, estado civil, actividades, puesto y perfil, **% de la relación en teletrabajo**, teléfono, domicilio, lugares de trabajo convenidos, razón social y domicilio del centro de trabajo, equipo de cómputo y ergonómico otorgado | Extender `TeleworkRegistration`: % de teletrabajo (y alerta si baja de 40 %, art. 330-A), varios lugares convenidos, actividades, puesto. Inventario de equipo entregado (ver 5.7). Export del listado | P0 |
| 5.2 | Política escrita con contenido mínimo (incluido el inciso e: horario pactado y distribución sin exceder máximos, pausas y desconexión; inciso h: lactancia) | Plantilla de política con secciones obligatorias; no se publica si falta una sección. Enlazar el horario pactado de cada teletrabajador | P0 |
| 5.3 | Informar riesgos ergonómicos y psicosociales al trabajador y a la Comisión de Seguridad e Higiene | Documento de riesgos con acuse del trabajador | P1 |
| 5.4–5.5 | Lista de verificación (Apéndice 3) **validada por la Comisión de Seguridad e Higiene** (visita o autoaplicación); sin condiciones no se teletrabaja desde ese lugar | Comparar los 8 puntos actuales contra el Apéndice 3 y completar. Agregar validación por un integrante de la Comisión (`validatedById`, resultado APTO / NO_APTO, fecha). Si es NO_APTO, bloquear el marcaje remoto desde ese lugar | P0 |
| 5.7 | Silla ergonómica o equivalente, insumos y aditamentos | `TeleworkEquipmentDelivery` con acuse de recibo | P1 |
| 5.9 / 8.1 | Capacitación al menos una vez al año | Registro de capacitación con vencimiento y alerta | P1 |
| 5.10 | Reversibilidad a presencial (LFT 330-G) | Solicitud de regreso con flujo y respuesta auditada | P1 |
| 5.11 | Exámenes médicos (NOM-030) y seguimiento de avisos de accidente | Registro de exámenes y avisos de riesgo de trabajo del teletrabajador | P2 |
| 5.13 | Atención en casos de violencia familiar | Canal confidencial y protocolo por cliente (acceso restringido) | P2 |
| 6.x | Avisos escritos del trabajador (cambio de domicilio, alteraciones, riesgos) con fecha de elaboración, nombre, fecha de ocurrencia y descripción | `TeleworkNotice` desde `/mi-jornada` con esos campos | P1 |
| 4.11 / 7.3 e) | Derecho a la desconexión | Además de registrar contactos: **el propio TimeManager no debe molestar fuera de horario**. Notificaciones in-app/correo/push al teletrabajador se difieren a su siguiente jornada (salvo urgentes marcadas), y RH ve un indicador de contactos fuera de horario por persona | P0 |
| 9 | Dictamen de unidad de inspección (opcional, vigencia 2 años) | Repositorio de dictámenes con vencimiento | P2 |
| 10.4 | Evidencias en papel o digitales, conservadas al menos 1 año | Retención mínima de 1 año para evidencias NOM-037 y "Expediente NOM-037" exportable por cliente | P1 |

## 5. Modelo de datos (propuesta)

- `WeeklyOvertimeLedger` (nuevo): `tenantId, userId, weekStart, year, ordinaryMin, otDoubleMin, otTripleMin, otIllegalMin, restDayWorkedMin, holidayWorkedMin, sundayWorked, minor, violations (JSON), days (JSON detalle), otEngineVersion, status (DRAFT/CONFIRMED/CLOSED), workerAckAt, workerAckHash`. Se recalcula hasta el cierre de nómina y se congela al cerrar.
- `OvertimeRequest` (nuevo): autorización previa + consentimiento del trabajador (`requestedById, reason, plannedMin, days, workerDecision, workerDecidedAt`).
- `OvertimeApproval`: pasa a referenciar el ledger semanal; estados de reconocimiento para pago.
- `Schedule`: `shiftType` calculado, `distributionAgreementId?`. `ScheduleDay` sin cambios.
- `NomSettings`: `weekStartDay`, política de pago (`payRoundingPolicy`, `minOvertimeMin` para nómina), solo valores más estrictos que la ley.
- `Holiday`, `LactationPeriod`, `WorkRecordAgreement` (acuerdo del método, R-01), `WorkRecordAcknowledgment` (conformidad periódica, R-01).
- `User.terminatedAt` (si no existe en otro modelo) para la retención del art. 804.
- NOM-037: campos nuevos en `TeleworkRegistration`, `TeleworkWorkplace`, `TeleworkEquipmentDelivery`, `TeleworkTraining`, `TeleworkNotice`, `TeleworkReversalRequest`, validación en `TeleworkChecklist`.
- Todo modelo nuevo entra en `TENANT_MODELS` con `tenantId` y RLS. Migraciones SQL a mano con backfill (regla del repo).

## 6. Fases y fechas

Hoy es 5-nov-2026; el escalón de 46 h y las disposiciones STPS entran el **1-ene-2027**.

| Fase | Fecha objetivo | Contenido |
|---|---|---|
| **F0 — Correcciones urgentes** ✅ (5-nov-2026) | 15-nov-2026 | Tabla legal 48/46/44/42/40 y 9/9/10/11/12 en código (1.1); alertas semanales contra el tope correcto; configuración solo más estricta (1.7); corregir [NOM_CUMPLIMIENTO.md](NOM_CUMPLIMIENTO.md) y [modules/nom.md](modules/nom.md) (dicen 46 h para 2027-2029 y que el registro es obligatorio hasta 2027) |
| **F1 — Motor semanal de horas extra** 🚧 (motor, ledger, turno H-01, festivos H-05 y export v1 hechos; resta UI/pre-nómina) | 10-dic-2026 | Algoritmo 1.3 + casos 1.4 + `WeeklyOvertimeLedger`; tipo de turno (H-01); festivos (H-05); menores; descanso de 7 días (H-07); registro sin tolerancias (1.6); aprobación por semana; pre-nómina y export con bolsas (R-04) |
| **F2 — Transición 2027** 🚧 (validación H-02 y reporte H-03; resta UI/avisos) | 15-dic-2026 | Validación de horarios (H-02) y asistente de transición (H-03) corrido en todos los clientes antes del 1-ene |
| **F3 — Prueba plena y retención** 🚧 (R-01 y 1.5 con UI en Mi jornada; R-02 en revisión) | 31-ene-2027 | Acuerdo del método y conformidad periódica (R-01); retención art. 804 (R-02); autorización previa y consentimiento de extra (1.5) |
| **F4 — NOM-037 completa** | 28-feb-2027 | Brechas P0/P1 de la sección 4, desconexión del propio sistema, expediente exportable |
| **F5 — Disposiciones STPS** | ≤ 30 días tras su publicación | Ámbito, excepciones, formato oficial del export, retención definitiva, sello encadenado (R-05), paquete de inspección (R-08) |
| **F6 — Pendientes P2** | 2027 | Exámenes médicos, violencia familiar, dictámenes |

Cada fase cierra con: `tsc`, lint, unitarios del motor (`pnpm test:unit`), integración del módulo
`nom`/`schedules`/`overtime`, y actualización de las fichas en `docs/modules/`.

## 7. Decisiones abiertas para el asesor laboral

1. Base del excedente triple de 4 h en 2026-2029: tope transitorio o 12 h del art. 66 (1.3).
2. Quinto día con extra o más de 4 h diarias: ¿triple o infracción directa? (1.3).
3. Semana que cruza el 1 de enero (1.2).
4. Exceso sobre la jornada en un día de descanso: ¿también extra? (1.2).
5. Extra trabajado sin orden y rechazado en aprobación (1.5).
6. Tolerancias y mínimo de 60 min como política de pago (1.6).
7. Jornada diaria del art. 61 por tipo de turno frente a la distribución libre del art. 58.
8. Redacción vigente del art. 178 (menores) y del art. 804 (retención).
9. Contenido de la lista de verificación frente al Apéndice 3 de la NOM-037 y validez de la autoaplicación.
10. Texto del acuerdo del método de registro y de la conformidad periódica para lograr la prueba plena del art. 132.

## Fuentes

- NOM-037-STPS-2023, DOF: https://dof.gob.mx/nota_detalle_popup.php?codigo=5691672
- Decreto de reforma a la LFT en materia de reducción de la jornada laboral, DOF 01-may-2026: https://dof.gob.mx/nota_detalle_popup.php?codigo=5786537
- Reforma constitucional art. 123 (DOF 03-mar-2026), resumen: https://politica.expansion.mx/mexico/2026/03/04/jornada-laboral-40-horas-publicada-dof-entra-en-vigor

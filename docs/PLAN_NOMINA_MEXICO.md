# Plan de nómina México (fiscal) — a partir de los datos del cliente

Fecha: 2026-11-05. Estado: **primera versión implementada** (motor configurable + UI; sin CFDI ni presentación IMSS, por decisión del cliente). Complementa la pre-nómina de asistencia
(`docs/modules/nom.md`) con el cálculo de percepciones, deducciones y prestaciones.

## 1. Datos capturados

| Dato | Valor |
|---|---|
| Salario base | $315.04 por 8 horas |
| Jornada | 48 h/semana (6 × 8 h) |
| Referencia del cliente | $1,800 semanales |
| Horas extra doble | hasta 9 h/semana |
| Horas extra triple | después de esas 9 h |

**Inconsistencia a confirmar:** $315.04 × 6 días = **$1,890.24/semana**, no $1,800.
Con $1,800/semana el salario diario sería **$300.00**. Hay que confirmar cuál es el
salario diario legal (el que va en el contrato/CFDI), porque de él cuelgan aguinaldo,
prima vacacional, finiquito, PTU, ISR e IMSS.

## 2. Fórmulas base

- Hora ordinaria = salario diario / 8.
  - Con $315.04: **$39.38/h**.
  - Con $300.00: **$37.50/h**.
- Semana ordinaria = salario diario × 6.
- Hora extra doble = hora ordinaria × 2; triple = hora ordinaria × 3.
- Tope legal de dobles: **9 h/semana** (2026; baja a 9, 9, 10, 11, 12 h hasta 2030);
  el excedente es triple. El motor actual `weekly-overtime-engine` ya clasifica esta bolsa.
- **Aguinaldo** = salario diario × 15 días × (días trabajados del año / 365).
- **Prima vacacional** = 25 % × (días de vacaciones × salario diario).
- **Vacaciones** = días devengados LFT art. 76 (ya implementado en `leave.service`).
- **Finiquito** = salario devengado pendiente + vacaciones proporcionales + prima
  vacacional + aguinaldo proporcional + prima de antigüedad (12 días por año, tope 2 SM)
  + indemnización constitucional (3 meses + 20 días/año) si aplica.
- **PTU** = 10 % de la utilidad repartible; 50 % por días trabajados y 50 % por salario.
  Requiere utilidad fiscal y ejercicios cerrados (insumo de la empresa/contador).
- **Vales** = monto mensual; exento hasta el límite de UMA que corresponda.
- **Fondo de ahorro** = aportación patrón/trabajador; exento dentro del límite fiscal.
- **ISR** = tarifa mensual/anual vigente + subsidio al empleo; requiere tablas oficiales.
- **IMSS** = cuotas obrero-patronales sobre SBC; requiere UMA/SM y ramos vigentes.

## 3. Lo que falta para implementar sin inventar reglas

1. **Salario diario real**: ¿$315.04 o $300.00 (para $1,800/semana)?
2. **Fecha de ingreso y vacaciones**: para aguinaldo, prima y finiquito proporcional.
3. **Año fiscal**: tarifas ISR, UMA, salario mínimo y cuotas IMSS aplicables.
4. **Política de vales y fondo de ahorro**: montos, frecuencia y tope exento.
5. **PTU**: utilidad repartible, días del ejercicio y criterio de la empresa.
6. **Contrato/tipo de baja**: para finiquito (renuncia, despido, término).
7. **CFDI/IMSS**: si el sistema solo calcula o también timbra y presenta.

## 4. Arquitectura propuesta

1. **Configuración fiscal por cliente** (`payroll_settings`): salario diario, SBC/SDI,
   zona, periodicidad, UMA/SM, tablas ISR y cuotas IMSS versionadas por año, política de
   vales/fondo y PTU.
2. **Motor puro** (`payroll-engine`): percepciones, deducciones y prestaciones a partir
   de asistencia + tiempo extra + incidencias + vacaciones. Sin BD, con tests de los
   ejemplos del cliente.
3. **Corrida de nómina** (`payroll_runs` / `payroll_receipts`): snapshot inmutable por
   persona con percepciones/deducciones, archivo CFDI (si aplica) y acuse.
4. **Recibos**: PDF/CSV con desglose y totales; conciliación con pre-nómina.
5. **Reportes**: ISR/IMSS por periodo, PTU y provisiones de aguinaldo/prima.

## 4.1 Implementado (2026-11-05)

- `payroll_settings` por cliente + motor puro + `GET/PUT /payroll/settings` y
  `POST /payroll/calculate`.
- UI `/payroll/settings`: salario, tope doble/triple, aguinaldo, prima, finiquito,
  PTU, vales, fondo, ISR/IMSS en tablas JSON y cálculo de prueba.
- **No** se timbra CFDI ni se presenta IMSS: cálculo y evidencia dentro de la plataforma.
- Pruebas: **123 unitarias** y **192 de integración** (motor + API).

## 5. Primer entregable recomendado

Con los datos actuales se puede construir el cálculo de **salario + horas extra doble/triple +
aguinaldo + prima vacacional + finiquito** y dejar ISR/IMSS/PTU/vales/fondo detrás de tablas
configurables. Antes de tocar dinero fiscal, confirmar los 7 puntos de §3 con el cliente/contador
y validar las tablas con un contador.

## 6. Riesgo

Un cálculo fiscal con tablas equivocadas es peor que no tenerlo: el sistema debe marcar
explícitamente la versión de tablas (año/UMA) y bloquear la corrida si falta configuración.

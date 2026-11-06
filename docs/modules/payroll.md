# Módulo `payroll` — nómina configurable

Cálculo de percepciones, deducciones y prestaciones **dentro de la plataforma**.
No timbra CFDI ni presenta ante el IMSS: esas integraciones son posteriores.

## Modelo

- `payroll_settings` (1 por cliente): salario diario por defecto, SBC, UMA, tope y
  multiplicadores de horas extra, aguinaldo, prima vacacional, vales, fondo de ahorro,
  PTU, prima de antigüedad, indemnización y **tablas ISR/IMSS en JSON** versionables.
- El motor (`services/payroll-engine.ts`) es puro: recibe configuración + periodo y
  devuelve conceptos con importe, gravado y exento.

## Endpoints

- `GET /payroll/settings` · `PUT /payroll/settings` (permiso `payroll.close`).
- `POST /payroll/calculate` (permiso `payroll.view`): sueldo, horas extra doble/triple,
  aguinaldo, prima vacacional, finiquito, PTU, vales, fondo, ISR e IMSS según configuración.

## Reglas

- La hora ordinaria = salario diario / horas base (default 8).
- El tope de horas dobles es configurable (default 9/semana); el excedente va triple.
- Exenciones de aguinaldo/prima/vales/fondo se configuran (UMA/mensual) y se prorratean.
- ISR: tarifa mensual en brackets `{lower, fixed, rate}` + subsidio; IMSS: cuotas
  `{workerPct, employerPct}` sobre SBC × días. Si están activos y falta la tabla, el
  cálculo falla con error explícito (nunca inventa tasas).
- PTU: `%` configurable, reparto 50 % días / 50 % salario con los totales del ejercicio.

## UI

`/payroll/settings` (Configuración → Nómina y prestaciones): captura de todos los
parámetros, tablas JSON y cálculo de prueba.

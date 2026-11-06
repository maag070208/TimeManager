import { useEffect, useState } from "react";
import { ITAlert, ITButton, ITCard, ITInput, ITPage, ITSelect, ITText, ITTextarea, ITToast } from "@axzydev/axzy_ui_system";
import { LuWallet } from "react-icons/lu";
import { payrollApi } from "@entities/payroll";
import type { PayrollIsrBracket, PayrollImssRate, PayrollSettings } from "@entities/payroll";

const todayKey = () => new Date().toISOString().slice(0, 10);

type FormState = Omit<PayrollSettings, "isrBrackets" | "imssRates"> & {
  isrBracketsText: string;
  imssRatesText: string;
};

const fromSettings = (settings: PayrollSettings): FormState => ({
  ...settings,
  isrBracketsText: JSON.stringify(settings.isrBrackets ?? [], null, 2),
  imssRatesText: JSON.stringify(settings.imssRates ?? [], null, 2),
});

/** Configuración fiscal y de prestaciones por cliente; todo es editable. */
export default function PayrollSettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [calc, setCalc] = useState({ daysWorked: 6, overtimeDoubleHours: 9, includeAguinaldo: true });
  const [result, setResult] = useState<Awaited<ReturnType<typeof payrollApi.calculate>> | null>(null);

  useEffect(() => {
    payrollApi
      .settings()
      .then((settings) => setForm(fromSettings(settings)))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo cargar la configuración."));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      let isrBrackets: PayrollIsrBracket[] | null = null;
      let imssRates: PayrollImssRate[] | null = null;
      try {
        isrBrackets = JSON.parse(form.isrBracketsText) as PayrollIsrBracket[];
        imssRates = JSON.parse(form.imssRatesText) as PayrollImssRate[];
      } catch {
        throw new Error("Las tablas ISR/IMSS deben ser JSON válido.");
      }
      const { isrBracketsText: _a, imssRatesText: _b, ...settings } = form;
      const saved = await payrollApi.updateSettings({ ...settings, isrBrackets, imssRates });
      setForm(fromSettings(saved));
      setToast("Configuración de nómina guardada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const calculate = async () => {
    setResult(null);
    try {
      setResult(
        await payrollApi.calculate({
          periodStart: todayKey(),
          periodEnd: todayKey(),
          daysWorked: calc.daysWorked,
          overtimeDoubleHours: calc.overtimeDoubleHours,
          includeAguinaldo: calc.includeAguinaldo,
          daysWorkedYear: 365,
        })
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo calcular.");
    }
  };

  if (!form) {
    return (
      <ITPage title="Nómina configurable" icon={<LuWallet size={20} />} maxWidth="7xl">
        {error ? <ITAlert variant="error">{error}</ITAlert> : <ITText muted>Cargando…</ITText>}
      </ITPage>
    );
  }

  const numeric = (key: keyof FormState, label: string, step = "0.01") => (
    <ITInput
      name={String(key)}
      label={label}
      type="number"
      value={form[key] === null || form[key] === undefined ? "" : String(form[key])}
      onChange={(event) => set(key, (event.target.value === "" ? null : Number(event.target.value)) as FormState[typeof key])}
    />
  );
  const numericInt = (key: keyof FormState, label: string) => (
    <ITInput
      name={String(key)}
      label={label}
      type="number"
      value={String(form[key] ?? 0)}
      onChange={(event) => set(key, Number(event.target.value) as FormState[typeof key])}
    />
  );

  return (
    <ITPage
      title="Nómina configurable"
      description="Salario, horas extra, aguinaldo, prima vacacional, finiquito, PTU, vales, fondo de ahorro, ISR e IMSS. Todo por cliente; sin timbrado CFDI ni presentación externa."
      icon={<LuWallet size={20} />}
      maxWidth="7xl"
    >
      <div className="flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Sueldo y horas extra</ITText>
          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {numeric("defaultDailySalary", "Salario diario (MXN)")}
            {numeric("sbcDaily", "SBC diario (opcional)")}
            {numeric("umaDaily", "UMA diaria (opcional)")}
            {numericInt("overtimeHourlyDivisor", "Horas base del día")}
            {numericInt("overtimeDoubleHoursPerWeek", "Tope de horas dobles / semana")}
            {numeric("overtimeDoubleMultiplier", "Multiplicador doble")}
            {numeric("overtimeTripleMultiplier", "Multiplicador triple")}
            {numericInt("aguinaldoDays", "Días de aguinaldo")}
            {numeric("vacationPremiumPct", "Prima vacacional (%)")}
            {numeric("aguinaldoExemptUmas", "Aguinaldo exento (UMA)")}
            {numeric("primaVacacionalExemptUmas", "Prima exenta (UMA)")}
            {numeric("ptuRatePct", "PTU (%)")}
          </div>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Vales, fondo y finiquito</ITText>
          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {numeric("valesMonthly", "Vales mensuales")}
            {numeric("valesExemptMonthly", "Vales exentos")}
            {numeric("fondoAhorroPct", "Fondo de ahorro (%)")}
            {numeric("fondoAhorroCapMonthly", "Tope fondo mensual")}
            {numeric("fondoAhorroExemptMonthly", "Fondo exento")}
            {numericInt("primaAntiguedadDaysPerYear", "Prima antigüedad días/año")}
            {numeric("primaAntiguedadCapDaily", "Tope prima antigüedad")}
            {numeric("severanceMonths", "Meses de indemnización")}
            {numericInt("severanceDaysPerYear", "Días/año de indemnización")}
          </div>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">ISR e IMSS (tablas configurables)</ITText>
          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <ITSelect
              name="isrEnabled"
              label="Calcular ISR"
              value={form.isrEnabled ? "true" : "false"}
              onChange={(event) => set("isrEnabled", event.target.value === "true")}
              options={[{ value: "false", label: "No" }, { value: "true", label: "Sí" }]}
            />
            {numeric("isrSubsidyMonthly", "Subsidio al empleo mensual")}
            <ITSelect
              name="imssEnabled"
              label="Calcular IMSS"
              value={form.imssEnabled ? "true" : "false"}
              onChange={(event) => set("imssEnabled", event.target.value === "true")}
              options={[{ value: "false", label: "No" }, { value: "true", label: "Sí" }]}
            />
          </div>
          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <ITTextarea
              name="isrBrackets"
              label="Tarifa ISR mensual (JSON: [{lower,fixed,rate}])"
              rows={7}
              value={form.isrBracketsText}
              onChange={(value) => set("isrBracketsText", value)}
            />
            <ITTextarea
              name="imssRates"
              label="Cuotas IMSS (JSON: [{key,label,workerPct,employerPct}])"
              rows={7}
              value={form.imssRatesText}
              onChange={(value) => set("imssRatesText", value)}
            />
          </div>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Probar cálculo</ITText>
          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <ITInput
              name="calcDays"
              label="Días del periodo"
              type="number"
              value={String(calc.daysWorked)}
              onChange={(event) => setCalc((prev) => ({ ...prev, daysWorked: Number(event.target.value) }))}
            />
            <ITInput
              name="calcDoubleHours"
              label="Horas dobles"
              type="number"
              value={String(calc.overtimeDoubleHours)}
              onChange={(event) => setCalc((prev) => ({ ...prev, overtimeDoubleHours: Number(event.target.value) }))}
            />
            <ITSelect
              name="includeAguinaldoCalc"
              label="Incluir aguinaldo"
              value={calc.includeAguinaldo ? "true" : "false"}
              onChange={(event) => setCalc((prev) => ({ ...prev, includeAguinaldo: event.target.value === "true" }))}
              options={[{ value: "true", label: "Sí" }, { value: "false", label: "No" }]}
            />
            <ITButton variant="outlined" color="primary" onClick={() => void calculate()}>
              Calcular
            </ITButton>
          </div>
          <ITText muted className="mt-2 block !text-[11px]">
            Los campos de prueba son independientes de la configuración guardada; el cálculo usa el salario diario configurado.
          </ITText>
          {result && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[12.5px]">
              <ITText className="font-semibold">Sueldo: ${result.dailySalary} · Hora: ${result.hourlySalary} · Días: {result.periodDays}</ITText>
              <ITText>Percepciones: ${result.perceptions} · Exento: ${result.exempt} · Gravado: ${result.taxable}</ITText>
              <ITText>ISR: ${result.isr} · IMSS trabajador: ${result.imssWorker} · IMSS patrón: ${result.imssEmployer}</ITText>
              <ITText className="font-bold">Neto: ${result.net} · Costo patronal: ${result.employerCost}</ITText>
              {result.warnings.map((warning) => <ITText key={warning} muted className="block">{warning}</ITText>)}
            </div>
          )}
        </ITCard>

        <ITButton variant="filled" color="primary" onClick={() => void save()} disabled={saving}>
          Guardar configuración
        </ITButton>
      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}

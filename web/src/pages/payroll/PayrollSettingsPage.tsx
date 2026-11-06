import { useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITInput, ITPage, ITSelect, ITText, ITTextarea, ITToast } from "@axzydev/axzy_ui_system";
import { LuCalculator, LuClock, LuPercent, LuReceipt, LuSave, LuShieldCheck, LuWallet } from "react-icons/lu";
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

  const configured = Boolean(form.defaultDailySalary && form.defaultDailySalary > 0);
  const hour = configured ? (form.defaultDailySalary ?? 0) / Math.max(1, form.overtimeHourlyDivisor) : 0;
  const weekly = (form.defaultDailySalary ?? 0) * 6;
  const doubleCapAmount = hour * 2 * form.overtimeDoubleHoursPerWeek;
  const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const field = (key: keyof FormState, label: string) => (
    <ITInput
      name={String(key)}
      label={label}
      type="number"
      value={form[key] === null || form[key] === undefined ? "" : String(form[key])}
      onChange={(event) => set(key, (event.target.value === "" ? null : Number(event.target.value)) as FormState[typeof key])}
    />
  );
  const fieldInt = (key: keyof FormState, label: string) => (
    <ITInput
      name={String(key)}
      label={label}
      type="number"
      value={String(form[key] ?? 0)}
      onChange={(event) => set(key, Number(event.target.value) as FormState[typeof key])}
    />
  );
  const grid = (cols = 240) => ({ gridTemplateColumns: `repeat(auto-fit, minmax(${cols}px, 1fr))` });

  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title="Nómina configurable"
      description="Salario, horas extra, prestaciones, ISR e IMSS por cliente. Cálculo y evidencia dentro de la plataforma; sin CFDI ni presentación externa."
      icon={<LuWallet size={20} />}
      actions={
        <ITButton variant="filled" color="primary" onClick={() => void save()} disabled={saving}>
          <LuSave size={15} className="mr-1" />
          {saving ? "Guardando…" : "Guardar configuración"}
        </ITButton>
      }
    >
      <div className="grid items-start gap-4 pb-12 lg:grid-cols-12">
        {error && (
          <div className="lg:col-span-12">
            <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
              {error}
            </ITAlert>
          </div>
        )}

        {/* Columna principal */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          <ITCard className="lg:col-span-8" contentClassName="!p-0">
            <div className="rounded-2xl bg-[#0f2e3d] px-5 py-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <ITText className="!text-[11px] font-semibold uppercase tracking-[0.08em] !text-white/60">
                    Salario y jornada
                  </ITText>
                  <ITText className="!text-2xl font-extrabold !text-white">
                    {configured ? money(form.defaultDailySalary ?? 0) : "Configura el salario diario"}
                  </ITText>
                  <ITText className="!text-[12px] !text-white/70">
                    {configured
                      ? `${money(hour)}/hora · ${money(weekly)} por semana de 6 días`
                      : "Sin salario no se puede calcular nómina"}
                  </ITText>
                </div>
                <ITBadget color={configured ? "success" : "warning"} size="sm">
                  {configured ? "Listo para calcular" : "Falta salario"}
                </ITBadget>
              </div>
              <div className="mt-3 grid gap-2" style={grid(150)}>
                {[
                  { label: "Hora ordinaria", value: money(hour), icon: <LuClock size={13} /> },
                  { label: "Tope doble", value: `${form.overtimeDoubleHoursPerWeek} h · ${money(doubleCapAmount)}`, icon: <LuCalculator size={13} /> },
                  { label: "Aguinaldo", value: `${form.aguinaldoDays} días`, icon: <LuReceipt size={13} /> },
                  { label: "PTU", value: `${form.ptuRatePct}%`, icon: <LuPercent size={13} /> },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-white/10 px-3 py-2">
                    <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-white/60">
                      {item.icon} {item.label}
                    </span>
                    <span className="block text-[14px] font-bold tabular-nums text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 p-4" style={grid(200)}>
              {field("defaultDailySalary", "Salario diario (MXN)")}
              {field("sbcDaily", "SBC diario (opcional)")}
              {field("umaDaily", "UMA diaria (opcional)")}
              {fieldInt("overtimeHourlyDivisor", "Horas base del día")}
            </div>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <LuClock size={16} className="text-slate-500" />
              <ITText className="font-bold">Horas extra</ITText>
            </div>
            <div className="mt-3 grid gap-3" style={grid(200)}>
              {fieldInt("overtimeDoubleHoursPerWeek", "Tope de horas dobles / semana")}
              {field("overtimeDoubleMultiplier", "Multiplicador doble")}
              {field("overtimeTripleMultiplier", "Multiplicador triple")}
            </div>
            <ITText muted className="mt-2 block !text-[11px]">
              El excedente del tope se paga con el multiplicador triple; se calcula sobre la hora ordinaria.
            </ITText>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <LuReceipt size={16} className="text-slate-500" />
              <ITText className="font-bold">Prestaciones</ITText>
            </div>
            <div className="mt-3 grid gap-3" style={grid(200)}>
              {fieldInt("aguinaldoDays", "Días de aguinaldo")}
              {field("aguinaldoExemptUmas", "Aguinaldo exento (UMA)")}
              {field("vacationPremiumPct", "Prima vacacional (%)")}
              {field("primaVacacionalExemptUmas", "Prima exenta (UMA)")}
              {field("valesMonthly", "Vales mensuales")}
              {field("valesExemptMonthly", "Vales exentos")}
              {field("fondoAhorroPct", "Fondo de ahorro (%)")}
              {field("fondoAhorroCapMonthly", "Tope fondo mensual")}
              {field("fondoAhorroExemptMonthly", "Fondo exento")}
              {field("ptuRatePct", "PTU (%)")}
            </div>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <LuShieldCheck size={16} className="text-slate-500" />
              <ITText className="font-bold">Finiquito</ITText>
            </div>
            <div className="mt-3 grid gap-3" style={grid(200)}>
              {fieldInt("primaAntiguedadDaysPerYear", "Prima antigüedad días/año")}
              {field("primaAntiguedadCapDaily", "Tope prima antigüedad")}
              {field("severanceMonths", "Meses de indemnización")}
              {fieldInt("severanceDaysPerYear", "Días/año de indemnización")}
            </div>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LuPercent size={16} className="text-slate-500" />
                <ITText className="font-bold">ISR e IMSS</ITText>
              </div>
              <div className="flex gap-2">
                <ITBadget color={form.isrEnabled ? "success" : "gray"} size="sm">ISR {form.isrEnabled ? "activo" : "inactivo"}</ITBadget>
                <ITBadget color={form.imssEnabled ? "success" : "gray"} size="sm">IMSS {form.imssEnabled ? "activo" : "inactivo"}</ITBadget>
              </div>
            </div>
            <div className="mt-3 grid gap-3" style={grid(200)}>
              <ITSelect
                name="isrEnabled"
                label="Calcular ISR"
                value={form.isrEnabled ? "true" : "false"}
                onChange={(event) => set("isrEnabled", event.target.value === "true")}
                options={[{ value: "false", label: "No" }, { value: "true", label: "Sí" }]}
              />
              {field("isrSubsidyMonthly", "Subsidio al empleo mensual")}
              <ITSelect
                name="imssEnabled"
                label="Calcular IMSS"
                value={form.imssEnabled ? "true" : "false"}
                onChange={(event) => set("imssEnabled", event.target.value === "true")}
                options={[{ value: "false", label: "No" }, { value: "true", label: "Sí" }]}
              />
            </div>
            <div className="mt-3 grid gap-3" style={grid(280)}>
              <ITTextarea
                name="isrBrackets"
                label="Tarifa ISR mensual (JSON: lower, fixed, rate)"
                rows={6}
                value={form.isrBracketsText}
                onChange={(value) => set("isrBracketsText", value)}
              />
              <ITTextarea
                name="imssRates"
                label="Cuotas IMSS (JSON: key, label, workerPct, employerPct)"
                rows={6}
                value={form.imssRatesText}
                onChange={(value) => set("imssRatesText", value)}
              />
            </div>
          </ITCard>
        </div>

        {/* Panel bento derecho */}
        <aside className="flex flex-col gap-4 lg:col-span-4 lg:sticky lg:top-4">
          <ITCard contentClassName="!p-5">
            <ITText className="font-bold">Resumen</ITText>
            <div className="mt-3 grid gap-2" style={grid(140)}>
              <div className="rounded-xl bg-slate-50 p-3">
                <ITText muted className="!text-[10.5px] font-semibold uppercase">Salario diario</ITText>
                <ITText className="!text-lg font-extrabold tabular-nums">{configured ? money(form.defaultDailySalary ?? 0) : "—"}</ITText>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <ITText muted className="!text-[10.5px] font-semibold uppercase">Hora</ITText>
                <ITText className="!text-lg font-extrabold tabular-nums">{configured ? money(hour) : "—"}</ITText>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <ITText muted className="!text-[10.5px] font-semibold uppercase">Semana 6 días</ITText>
                <ITText className="!text-lg font-extrabold tabular-nums">{configured ? money(weekly) : "—"}</ITText>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <ITText muted className="!text-[10.5px] font-semibold uppercase">Dobles/semana</ITText>
                <ITText className="!text-lg font-extrabold tabular-nums">{form.overtimeDoubleHoursPerWeek} h</ITText>
              </div>
            </div>
            <ITText muted className="mt-3 block !text-[11px]">
              Confirmar con el cliente/contador si el salario diario es $315.04 o $300.00 (para $1,800/semana).
            </ITText>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <LuCalculator size={16} className="text-slate-500" />
              <ITText className="font-bold">Probar cálculo</ITText>
            </div>
            <div className="mt-3 grid gap-2" style={grid(120)}>
              <ITInput
                name="calcDays"
                label="Días"
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
            </div>
            <label className="mt-2 flex items-center gap-2 text-[12px] text-slate-600">
              <input
                type="checkbox"
                checked={calc.includeAguinaldo}
                onChange={(event) => setCalc((prev) => ({ ...prev, includeAguinaldo: event.target.checked }))}
              />
              Incluir aguinaldo
            </label>
            <ITButton variant="outlined" color="primary" className="mt-2 w-full" onClick={() => void calculate()}>
              Calcular con esta configuración
            </ITButton>
            {result ? (
              <div className="mt-3 flex flex-col gap-1 rounded-xl bg-slate-50 p-3 text-[12.5px]">
                <ITText className="font-semibold">Percepciones: {money(result.perceptions)}</ITText>
                <ITText muted className="!text-[11.5px]">Gravado: {money(result.taxable)} · Exento: {money(result.exempt)}</ITText>
                <ITText className="!text-[12px]">ISR: {money(result.isr)} · IMSS: {money(result.imssWorker)}</ITText>
                <ITText className="!text-[15px] font-extrabold">Neto: {money(result.net)}</ITText>
                <ITText muted className="!text-[11.5px]">Costo patronal: {money(result.employerCost)}</ITText>
                {result.warnings.map((warning) => (
                  <ITText key={warning} muted className="!text-[11px]">{warning}</ITText>
                ))}
              </div>
            ) : (
              <ITText muted className="mt-2 block !text-[11.5px]">
                Usa el salario guardado y las horas extra configuradas para previsualizar el recibo.
              </ITText>
            )}
          </ITCard>

          <ITButton variant="filled" color="primary" className="w-full" onClick={() => void save()} disabled={saving}>
            <LuSave size={15} className="mr-1" />
            {saving ? "Guardando…" : "Guardar configuración"}
          </ITButton>
        </aside>
      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}

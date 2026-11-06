import { useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITConfirmDialog, ITInput, ITPage, ITSelect, ITText, ITToast } from "@axzydev/axzy_ui_system";
import { LuBuilding2, LuCalendarDays, LuSignature, LuSave, LuShieldCheck, LuWallet, LuClock } from "react-icons/lu";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@app/store";
import { meThunk } from "@entities/user";
import { nomApi, type NomConfigDto } from "@entities/nom";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Configuración del cliente: semana, política de asistencia, límites y checada web. */
export default function GeneralSettingsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const tenant = useSelector((state: RootState) => state.auth.user?.tenant);
  const [config, setConfig] = useState<NomConfigDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [form, setForm] = useState({
    weekStartDay: 3,
    entryToleranceMin: 10,
    exitToleranceMin: 10,
    mealBreakMin: 0,
    minOvertimeMin: 60,
    workdayLimitMinutes: 720,
    weeklyLimitMinutes: 2880,
    retentionMonths: "",
    remotePunchEnabled: true,
    remoteCountsForWorkday: true,
    blockRemoteWithoutAgreement: true,
    requireUnionForCollective: true,
  });

  useEffect(() => {
    nomApi
      .getConfig()
      .then((next: NomConfigDto) => {
        setConfig(next);
        setForm({
          weekStartDay: next.weekStartDay ?? 3,
          entryToleranceMin: next.attendanceDefaults?.entryToleranceMin ?? 10,
          exitToleranceMin: next.attendanceDefaults?.exitToleranceMin ?? 10,
          mealBreakMin: next.attendanceDefaults?.mealBreakMin ?? 0,
          minOvertimeMin: next.attendanceDefaults?.minOvertimeMin ?? 60,
          workdayLimitMinutes: next.workdayLimitMinutes ?? 720,
          weeklyLimitMinutes: next.weeklyLimitMinutes ?? 2880,
          retentionMonths: next.retentionMonths ? String(next.retentionMonths) : "",
          remotePunchEnabled: next.remotePunchEnabled ?? true,
          remoteCountsForWorkday: next.remoteCountsForWorkday ?? true,
          blockRemoteWithoutAgreement: next.blockRemoteWithoutAgreement ?? true,
          requireUnionForCollective: next.requireUnionForCollective ?? true,
        });
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo cargar la configuración."))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const archive = async () => {
    setArchiving(true);
    setError(null);
    try {
      const result = await nomApi.archiveRetention(false);
      setToast(
        `Archivado: ${result.punches} checadas, ${result.accessEvents} eventos, ${result.remotePunches} remotos y ${result.adjustments} ajustes.`
      );
      setConfirmArchive(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo archivar.");
    } finally {
      setArchiving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await nomApi.updateConfig({
        weekStartDay: form.weekStartDay,
        defaultEntryToleranceMin: form.entryToleranceMin,
        defaultExitToleranceMin: form.exitToleranceMin,
        defaultMealBreakMin: form.mealBreakMin,
        defaultMinOvertimeMin: form.minOvertimeMin,
        workdayLimitMinutes: form.workdayLimitMinutes,
        weeklyLimitMinutes: form.weeklyLimitMinutes,
        retentionMonths: form.retentionMonths ? Number(form.retentionMonths) : null,
        remotePunchEnabled: form.remotePunchEnabled,
        remoteCountsForWorkday: form.remoteCountsForWorkday,
        blockRemoteWithoutAgreement: form.blockRemoteWithoutAgreement,
        requireUnionForCollective: form.requireUnionForCollective,
      });
      await dispatch(meThunk()).unwrap().catch(() => undefined);
      setToast("Configuración guardada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };


  const weekDay = DAYS[form.weekStartDay] ?? "Miércoles";
  const fieldSet = { gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" };
  const summaryTiles = [
    { label: "Semana", value: weekDay, icon: <LuCalendarDays size={13} /> },
    { label: "Entrada", value: `${form.entryToleranceMin} min`, icon: <LuClock size={13} /> },
    { label: "Comida", value: `${form.mealBreakMin} min`, icon: <LuClock size={13} /> },
    { label: "Tope diario", value: `${Math.round(form.workdayLimitMinutes / 60)} h`, icon: <LuShieldCheck size={13} /> },
  ];

  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title="Configuración del cliente"
      description="Semana, asistencia, límites legales, checada web y convenios. Todo por cliente."
      icon={<LuBuilding2 size={20} />}
      actions={
        <ITButton variant="filled" color="primary" onClick={() => void save()} disabled={saving || loading}>
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

        <div className="flex flex-col gap-4 lg:col-span-8">
          <ITCard contentClassName="!p-0">
            <div className="rounded-2xl bg-[#0f2e3d] px-5 py-4 text-white">
              <ITText className="!text-[11px] font-semibold uppercase tracking-[0.08em] !text-white/60">
                Operación del cliente
              </ITText>
              <ITText className="!text-2xl font-extrabold !text-white">
                Semana {weekDay.toLowerCase()} → {DAYS[(form.weekStartDay + 6) % 7].toLowerCase()}
              </ITText>
              <ITText className="!text-[12px] !text-white/70">
                Aplica a horarios, pre-nómina, tiempo extra, asistencia y bitácoras.
              </ITText>
              <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                {summaryTiles.map((tile) => (
                  <div key={tile.label} className="rounded-xl bg-white/10 px-3 py-2">
                    <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-white/60">
                      {tile.icon} {tile.label}
                    </span>
                    <span className="block text-[14px] font-bold capitalize text-white">{tile.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 p-4" style={fieldSet}>
              <ITSelect
                name="weekStartDay"
                label="Primer día de la semana"
                value={String(form.weekStartDay)}
                onChange={(event) => set("weekStartDay", Number(event.target.value))}
                options={DAYS.map((day, index) => ({ value: String(index), label: day }))}
              />
              <ITInput
                name="timezone"
                label="Zona horaria"
                value={tenant?.timezone ?? "—"}
                disabled
                onChange={() => undefined}
              />
            </div>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <LuClock size={16} className="text-slate-500" />
              <ITText className="font-bold">Política de asistencia</ITText>
              <ITText muted className="!text-[11px]">(horarios nuevos)</ITText>
            </div>
            <div className="mt-3 grid gap-3" style={fieldSet}>
              <ITInput name="entryToleranceMin" label="Tolerancia de entrada (min)" type="number" value={String(form.entryToleranceMin)} onChange={(e) => set("entryToleranceMin", Number(e.target.value))} />
              <ITInput name="exitToleranceMin" label="Tolerancia de salida (min)" type="number" value={String(form.exitToleranceMin)} onChange={(e) => set("exitToleranceMin", Number(e.target.value))} />
              <ITInput name="mealBreakMin" label="Comida (min)" type="number" value={String(form.mealBreakMin)} onChange={(e) => set("mealBreakMin", Number(e.target.value))} />
              <ITInput name="minOvertimeMin" label="Mínimo de tiempo extra (min)" type="number" value={String(form.minOvertimeMin)} onChange={(e) => set("minOvertimeMin", Number(e.target.value))} />
            </div>
            <Link to="/schedules" className="mt-3 inline-block text-[12px] font-semibold underline-offset-4 hover:underline">
              Configurar horarios por puesto →
            </Link>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <LuShieldCheck size={16} className="text-slate-500" />
              <ITText className="font-bold">Límites y retención</ITText>
            </div>
            <div className="mt-3 grid gap-3" style={fieldSet}>
              <ITInput name="workdayLimitMinutes" label="Máximo diario (min)" type="number" value={String(form.workdayLimitMinutes)} onChange={(e) => set("workdayLimitMinutes", Number(e.target.value))} />
              <ITInput name="weeklyLimitMinutes" label="Máximo semanal (min)" type="number" value={String(form.weeklyLimitMinutes)} onChange={(e) => set("weeklyLimitMinutes", Number(e.target.value))} />
              <ITInput name="retentionMonths" label="Retención (meses, vacío = sin archivar)" type="number" value={form.retentionMonths} onChange={(e) => set("retentionMonths", e.target.value)} />
            </div>
            {config?.legal && (
              <ITText muted className="mt-2 block !text-[11.5px]">
                Ley {config.legal.year}: {Math.round(config.legal.workdayLimitMinutes / 60)} h/día y {Math.round(config.legal.weeklyLimitMinutes / 60)} h/semana. Solo topes más estrictos.
              </ITText>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ITButton variant="outlined" color="secondary" size="sm" disabled={archiving} onClick={() => setConfirmArchive(true)}>
                {archiving ? "Archivando…" : "Archivar registros vencidos"}
              </ITButton>
              <ITText muted className="!text-[11px]">Mueve a archivo respetando el piso legal; queda auditado.</ITText>
            </div>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <LuShieldCheck size={16} className="text-slate-500" />
              <ITText className="font-bold">Checada web y decisiones legales</ITText>
            </div>
            <div className="mt-3 grid gap-3" style={fieldSet}>
              <ITSelect name="remotePunchEnabled" label="Checada desde la web" value={form.remotePunchEnabled ? "true" : "false"} onChange={(e) => set("remotePunchEnabled", e.target.value === "true")} options={[{ value: "true", label: "Permitida" }, { value: "false", label: "Deshabilitada" }]} />
              <ITSelect name="remoteCountsForWorkday" label="Cuenta para la jornada" value={form.remoteCountsForWorkday ? "true" : "false"} onChange={(e) => set("remoteCountsForWorkday", e.target.value === "true")} options={[{ value: "true", label: "Sí (si no hay reloj)" }, { value: "false", label: "No" }]} />
              <ITSelect name="blockRemoteWithoutAgreement" label="Exigir acuerdo para checar web" value={form.blockRemoteWithoutAgreement ? "true" : "false"} onChange={(e) => set("blockRemoteWithoutAgreement", e.target.value === "true")} options={[{ value: "true", label: "Sí, bloquear sin acuerdo" }, { value: "false", label: "No" }]} />
              <ITSelect name="requireUnionForCollective" label="Convenio colectivo exige sindicato" value={form.requireUnionForCollective ? "true" : "false"} onChange={(e) => set("requireUnionForCollective", e.target.value === "true")} options={[{ value: "true", label: "Sí" }, { value: "false", label: "No, permitir trabajador" }]} />
            </div>
          </ITCard>
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4 lg:sticky lg:top-4">
          <ITCard contentClassName="!p-5">
            <ITText className="font-bold">Resumen</ITText>
            <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              {summaryTiles.map((tile) => (
                <div key={tile.label} className="rounded-xl bg-slate-50 p-3">
                  <ITText muted className="!text-[10.5px] font-semibold uppercase">{tile.label}</ITText>
                  <ITText className="!text-base font-extrabold capitalize">{tile.value}</ITText>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ITBadget color={form.remotePunchEnabled ? "success" : "gray"} size="sm">
                Web {form.remotePunchEnabled ? "activa" : "inactiva"}
              </ITBadget>
              <ITBadget color={form.blockRemoteWithoutAgreement ? "warning" : "gray"} size="sm">
                {form.blockRemoteWithoutAgreement ? "Acuerdo obligatorio" : "Sin bloqueo"}
              </ITBadget>
            </div>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <ITText className="font-bold">Accesos</ITText>
            <div className="mt-3 flex flex-col gap-2 text-[12.5px] font-semibold">
              <Link to="/schedules" className="flex items-center gap-2 hover:underline">
                <LuCalendarDays size={14} /> Horarios y tolerancias
              </Link>
              <Link to="/hr/jornada-acuerdos" className="flex items-center gap-2 hover:underline">
                <LuSignature size={14} /> Convenios y acuerdos
              </Link>
              <Link to="/payroll/settings" className="flex items-center gap-2 hover:underline">
                <LuWallet size={14} /> Nómina y prestaciones
              </Link>
              <Link to="/hr/leave" className="flex items-center gap-2 hover:underline">
                <LuCalendarDays size={14} /> Vacaciones y permisos
              </Link>
              <Link to="/teletrabajo" className="flex items-center gap-2 hover:underline">
                <LuShieldCheck size={14} /> Teletrabajo NOM-037
              </Link>
            </div>
          </ITCard>

          <ITButton variant="filled" color="primary" className="w-full" onClick={() => void save()} disabled={saving || loading}>
            <LuSave size={15} className="mr-1" />
            {saving ? "Guardando…" : "Guardar configuración"}
          </ITButton>
        </aside>
      </div>

      <ITConfirmDialog
        isOpen={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={() => void archive()}
        title="Archivar registros vencidos"
        message="Se moverán a las tablas de archivo las checadas, eventos, marcajes web y ajustes que ya cumplieron la retención. La evidencia no se borra."
        confirmLabel="Archivar"
        cancelLabel="Cancelar"
        variant="warning"
        loading={archiving}
      />
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}

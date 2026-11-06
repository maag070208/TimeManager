import { useEffect, useState } from "react";
import { ITAlert, ITButton, ITCard, ITConfirmDialog, ITInput, ITPage, ITSelect, ITText, ITToast } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { LuSettings } from "react-icons/lu";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@app/store";
import { meThunk } from "@entities/user";
import { nomApi, type NomConfigDto } from "@entities/nom";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Configuración del cliente: semana, política de asistencia, límites y checada web. */
export default function GeneralSettingsPage() {
  const { t } = useTranslation(["nom", "common"]);
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

  const legal = config?.legal;

  return (
    <ITPage
      title="Configuración del cliente"
      description="Define cómo opera tu empresa: semana, horarios, retardos, límites legales y checada web."
      icon={<LuSettings size={20} />}
      maxWidth="3xl"
    >
      <div className="flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error">{error}</ITAlert>}

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Operación</ITText>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <ITText muted className="mt-2 block !text-[11.5px]">
            La semana aplica a horarios, pre-nómina, tiempo extra, asistencia y bitácoras.
          </ITText>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Política de asistencia (horarios nuevos)</ITText>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <ITText className="font-bold">Límites de jornada y retención</ITText>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ITInput name="workdayLimitMinutes" label="Máximo diario (min)" type="number" value={String(form.workdayLimitMinutes)} onChange={(e) => set("workdayLimitMinutes", Number(e.target.value))} />
            <ITInput name="weeklyLimitMinutes" label="Máximo semanal (min)" type="number" value={String(form.weeklyLimitMinutes)} onChange={(e) => set("weeklyLimitMinutes", Number(e.target.value))} />
          </div>
          {legal && (
            <ITText muted className="mt-2 block !text-[11.5px]">
              Ley {legal.year}: {Math.round(legal.workdayLimitMinutes / 60)} h/día y {Math.round(legal.weeklyLimitMinutes / 60)} h/semana. Solo puedes configurar topes más estrictos.
            </ITText>
          )}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ITInput name="retentionMonths" label="Retención de registros (meses, vacío = sin archivar)" type="number" value={form.retentionMonths} onChange={(e) => set("retentionMonths", e.target.value)} />
            <ITSelect
              name="remotePunchEnabled"
              label="Checada desde la web"
              value={form.remotePunchEnabled ? "true" : "false"}
              onChange={(event) => set("remotePunchEnabled", event.target.value === "true")}
              options={[{ value: "true", label: "Permitida" }, { value: "false", label: "Deshabilitada" }]}
            />
            <ITSelect
              name="remoteCountsForWorkday"
              label="Checada web cuenta para la jornada"
              value={form.remoteCountsForWorkday ? "true" : "false"}
              onChange={(event) => set("remoteCountsForWorkday", event.target.value === "true")}
              options={[{ value: "true", label: "Sí (si no hay reloj)" }, { value: "false", label: "No" }]}
            />
            <ITSelect
              name="blockRemoteWithoutAgreement"
              label="Exigir acuerdo para checar en web"
              value={form.blockRemoteWithoutAgreement ? "true" : "false"}
              onChange={(event) => set("blockRemoteWithoutAgreement", event.target.value === "true")}
              options={[{ value: "true", label: "Sí, bloquear sin acuerdo" }, { value: "false", label: "No" }]}
            />
            <ITSelect
              name="requireUnionForCollective"
              label="Convenio colectivo exige sindicato"
              value={form.requireUnionForCollective ? "true" : "false"}
              onChange={(event) => set("requireUnionForCollective", event.target.value === "true")}
              options={[{ value: "true", label: "Sí" }, { value: "false", label: "No, permitir trabajador" }]}
            />
          </div>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Retención y archivado</ITText>
          <ITText muted className="mt-1 block !text-[11.5px]">
            Mueve a las tablas de archivo los registros vencidos respetando el piso legal. La corrida queda auditada.
          </ITText>
          <ITButton
            variant="outlined"
            color="secondary"
            className="mt-3"
            disabled={archiving}
            onClick={() => setConfirmArchive(true)}
          >
            {archiving ? "Archivando…" : "Archivar registros vencidos ahora"}
          </ITButton>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Más configuración</ITText>
          <div className="mt-2 flex flex-wrap gap-4 text-[12px] font-semibold underline-offset-4">
            <Link to="/hr/leave" className="hover:underline">Vacaciones y tipos de permiso →</Link>
            <Link to="/teletrabajo" className="hover:underline">Teletrabajo NOM-037 →</Link>
            <Link to="/schedules/overtime/approval" className="hover:underline">Tiempo extra →</Link>
          </div>
        </ITCard>

        <div>
          <ITButton variant="filled" color="primary" onClick={() => void save()} disabled={saving || loading}>
            {t("common:actions.save", { defaultValue: "Guardar configuración" })}
          </ITButton>
        </div>
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

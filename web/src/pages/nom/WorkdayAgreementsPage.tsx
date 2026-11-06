import { useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITPage, ITText, ITTextarea, ITToast, ITDatePicker } from "@axzydev/axzy_ui_system";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import { HelpTip } from "@shared/ui/help-tip";
import { LuSignature } from "react-icons/lu";
import { nomApi } from "@entities/nom";
import type { DistributionAgreement, RecordAgreementAdmin } from "@entities/nom";
import { usersApi } from "@entities/user";

const todayKey = () => new Date().toISOString().slice(0, 10);
const dateOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

/** RH: convenios de distribución (art. 58) y acuerdos de método de registro. */
const dateStrToLocal = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};
const localToDateStr = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function WorkdayAgreementsPage() {
  const [agreements, setAgreements] = useState<DistributionAgreement[]>([]);
  const [recordAgreements, setRecordAgreements] = useState<RecordAgreementAdmin[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; employeeNumber?: string | null }>>([]);
  const [form, setForm] = useState({
    userId: "",
    kind: "INDIVIDUAL" as "INDIVIDUAL" | "COLECTIVO",
    party: "WORKER" as "WORKER" | "UNION",
    effectiveFrom: todayKey(),
    effectiveTo: "",
    evidenceText: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const [nextAgreements, nextRecords, people] = await Promise.all([
        nomApi.distributionAgreements(),
        nomApi.recordAgreements(),
        usersApi.list(),
      ]);
      setAgreements(nextAgreements);
      setRecordAgreements(nextRecords);
      setEmployees((people ?? []).filter((row) => row.active).map((row) => ({ id: row.id, name: row.name, employeeNumber: row.employeeNumber })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los acuerdos.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setBusy("create");
    setError(null);
    try {
      await nomApi.createDistributionAgreement({
        userId: form.userId,
        kind: form.kind,
        party: form.kind === "COLECTIVO" ? "UNION" : form.party,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        evidenceText: form.evidenceText,
      });
      setToast("Convenio registrado. Falta la aceptación del trabajador o sindicato.");
      setForm((prev) => ({ ...prev, evidenceText: "" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el convenio.");
    } finally {
      setBusy(null);
    }
  };

  const sign = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await nomApi.signRecordAgreement(id);
      setToast("Acuerdo firmado por el patrón.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo firmar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ITPage
      title="Convenios y acuerdos"
      description="Convenio de distribución de jornada (art. 58) y acuerdo de método de registro firmado por ambas partes."
      icon={<LuSignature size={20} />}
      maxWidth="7xl"
    >
      <div className="flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}

        <div className="rounded-2xl bg-[#eaf6ef] px-5 py-4 text-slate-900">
          <span className="flex items-center gap-1.5">
            <ITText className="!text-[11px] font-semibold uppercase tracking-[0.08em] !text-slate-500">
              Cumplimiento de jornada
            </ITText>
            <HelpTip text="Convenio de distribución (art. 58 LFT): reparte las horas de la semana sin aumentar la jornada. Acuerdo de método de registro: el trabajador acepta cómo checa y RH firma el cierre de la prueba." />
          </span>
          <ITText className="!text-2xl font-extrabold !text-slate-900">
            {agreements.length} convenio(s) · {recordAgreements.length} acuerdo(s) de registro
          </ITText>
          <ITText className="!text-[12px] !text-slate-600">
            {agreements.filter((row) => !row.acceptedAt).length} convenio(s) pendiente(s) de aceptación ·{" "}
            {recordAgreements.filter((row) => !row.employerAcceptedAt).length} acuerdo(s) con firma patronal pendiente.
          </ITText>
        </div>

        <ITCard contentClassName="!p-5">
          <div className="flex items-center gap-2">
            <ITText className="font-bold">Nuevo convenio de distribución (art. 58)</ITText>
            <HelpTip text="Solo redistribuye horas dentro de la semana: no puede exceder los topes legales ni reducir el descanso. Colectivo = con sindicato; individual = acuerdo con la persona." />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ITSearchSelect
              name="agreementUser"
              label="Persona"
              value={form.userId}
              onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
              options={employees.map((employee) => ({
                value: employee.id,
                label: employee.employeeNumber ? `${employee.name} (${employee.employeeNumber})` : employee.name,
              }))}
            />
            <ITSearchSelect
              name="agreementKind"
              label="Tipo"
              value={form.kind}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  kind: event.target.value as typeof prev.kind,
                  party: event.target.value === "COLECTIVO" ? "UNION" : prev.party,
                }))
              }
              options={[{ value: "INDIVIDUAL", label: "Individual" }, { value: "COLECTIVO", label: "Colectivo (sindicato)" }]}
            />
            <ITSearchSelect
              name="agreementParty"
              label="Parte que acepta"
              value={form.kind === "COLECTIVO" ? "UNION" : form.party}
              onChange={(event) => setForm((prev) => ({ ...prev, party: event.target.value as typeof prev.party }))}
              options={[
                { value: "WORKER", label: "Trabajador" },
                { value: "UNION", label: "Representación sindical" },
              ]}
              disabled={form.kind === "COLECTIVO"}
            />
            <ITDatePicker
              name="agreementFrom"
              label="Vigente desde"
              value={dateStrToLocal(form.effectiveFrom)}
              onChange={(event) => {
                const value = event.target.value;
                setForm((prev) => ({ ...prev, effectiveFrom: value instanceof Date ? localToDateStr(value) : "" }));
              }}
            />
            <ITDatePicker
              name="agreementTo"
              label="Vigente hasta (opcional)"
              value={dateStrToLocal(form.effectiveTo)}
              onChange={(event) => {
                const value = event.target.value;
                setForm((prev) => ({ ...prev, effectiveTo: value instanceof Date ? localToDateStr(value) : "" }));
              }}
            />
          </div>
          <div className="mt-3">
            <ITTextarea
              name="agreementEvidence"
              label="Evidencia del acuerdo (fecha, firmantes, documento o referencia)"
              value={form.evidenceText}
              rows={3}
              onChange={(value) => setForm((prev) => ({ ...prev, evidenceText: value }))}
            />
          </div>
          <ITButton
            variant="filled"
            color="primary"
            className="mt-3"
            disabled={busy === "create" || !form.userId || form.evidenceText.trim().length < 20}
            onClick={() => void create()}
          >
            Registrar convenio
          </ITButton>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <div className="flex items-center gap-2">
            <ITText className="font-bold">Convenios registrados</ITText>
            <HelpTip text="El convenio queda vigente desde la fecha indicada, pero no se considera aceptado hasta que el trabajador o el sindicato lo aceptan por el portal; luego RH lo firma." />
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {agreements.length === 0 && <ITText muted className="!text-[12px]">Sin convenios registrados.</ITText>}
            {agreements.map((agreement) => (
              <div key={agreement.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <ITText className="font-semibold !text-[13px]">
                    {agreement.user?.name ?? "—"} · {agreement.kind === "COLECTIVO" ? "Colectivo" : "Individual"} ·{" "}
                    {agreement.party === "UNION" ? "Sindicato" : "Trabajador"}
                  </ITText>
                  <ITText muted className="!text-[11.5px]">
                    Vigencia {dateOf(agreement.effectiveFrom)} – {agreement.effectiveTo ? dateOf(agreement.effectiveTo) : "indefinida"}
                  </ITText>
                </div>
                <ITBadget color={agreement.acceptedAt ? "success" : "warning"} size="sm">
                  {agreement.acceptedAt ? "Aceptado" : "Pendiente de aceptación"}
                </ITBadget>
              </div>
            ))}
          </div>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <div className="flex items-center gap-2">
            <ITText className="font-bold">Acuerdos de método de registro</ITText>
            <HelpTip text="Prueba plena del registro: el trabajador acepta el texto y los métodos (reloj, web, app o mixto). RH cierra la prueba con la firma patronal; queda versión y fecha para auditoría." />
          </div>
          <ITText muted className="mt-1 block !text-[11.5px]">
            El trabajador acepta el texto y métodos; RH cierra la prueba con la firma patronal.
          </ITText>
          <div className="mt-2 flex flex-col gap-2">
            {recordAgreements.length === 0 && <ITText muted className="!text-[12px]">Sin acuerdos aceptados.</ITText>}
            {recordAgreements.map((agreement) => (
              <div key={agreement.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <ITText className="font-semibold !text-[13px]">{agreement.user?.name ?? "—"}</ITText>
                  <ITText muted className="!text-[11.5px]">
                    Métodos: {agreement.methods.join(" + ")} · versión {agreement.textVersion} · trabajador {dateOf(agreement.acceptedAt)}
                  </ITText>
                </div>
                <div className="flex items-center gap-2">
                  <ITBadget color={agreement.employerAcceptedAt ? "success" : "warning"} size="sm">
                    {agreement.employerAcceptedAt ? "Firmado por patrón" : "Firma patronal pendiente"}
                  </ITBadget>
                  {!agreement.employerAcceptedAt && (
                    <ITButton
                      variant="outlined"
                      color="primary"
                      size="sm"
                      disabled={busy === agreement.id}
                      onClick={() => void sign(agreement.id)}
                    >
                      Firmar como patrón
                    </ITButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ITCard>
      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2800} onClose={() => setToast(null)} />}
    </ITPage>
  );
}

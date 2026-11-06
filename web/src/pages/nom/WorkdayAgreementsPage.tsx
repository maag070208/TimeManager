import { useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITInput, ITPage, ITSelect, ITText, ITTextarea, ITToast } from "@axzydev/axzy_ui_system";
import { LuSignature } from "react-icons/lu";
import { nomApi } from "@entities/nom";
import type { DistributionAgreement, RecordAgreementAdmin } from "@entities/nom";
import { usersApi } from "@entities/user";

const todayKey = () => new Date().toISOString().slice(0, 10);
const dateOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

/** RH: convenios de distribución (art. 58) y acuerdos de método de registro. */
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

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Nuevo convenio de distribución (art. 58)</ITText>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ITSelect
              name="agreementUser"
              label="Persona"
              value={form.userId}
              onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
              options={employees.map((employee) => ({
                value: employee.id,
                label: employee.employeeNumber ? `${employee.name} (${employee.employeeNumber})` : employee.name,
              }))}
            />
            <ITSelect
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
            <ITSelect
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
            <label className="flex flex-col gap-1 text-[12px] text-slate-600">
              Vigente desde
              <input
                type="date"
                name="agreementFrom"
                value={form.effectiveFrom}
                onChange={(event) => setForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))}
                className="rounded-md border border-slate-200 px-2 py-2 text-[13px]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-slate-600">
              Vigente hasta (opcional)
              <input
                type="date"
                name="agreementTo"
                value={form.effectiveTo}
                onChange={(event) => setForm((prev) => ({ ...prev, effectiveTo: event.target.value }))}
                className="rounded-md border border-slate-200 px-2 py-2 text-[13px]"
              />
            </label>
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
          <ITText className="font-bold">Convenios registrados</ITText>
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
          <ITText className="font-bold">Acuerdos de método de registro</ITText>
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

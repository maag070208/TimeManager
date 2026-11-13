import { useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITCheckbox, ITText, ITTextarea, ITToast, ITDatePicker } from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import { LuCalendarClock, LuClockAlert, LuFileCheck, LuSignature } from "react-icons/lu";
import { PunchCorrections } from "@features/nom/punch-corrections";
import { nomApi } from "@entities/nom";
import type { DistributionAgreement, RecordAgreementAdmin } from "@entities/nom";
import { usersApi } from "@entities/user";
import { TabBar, type TabBarItem } from "@shared/ui/tab-bar";
import { TicState } from "@shared/ui/tic";

const todayKey = () => new Date().toISOString().slice(0, 10);
const dayOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
const dateOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

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

const METHOD_LABEL: Record<string, string> = { CLOCK: "Reloj", REMOTE: "Web o app", ACCESS: "Control de acceso" };
const MIN_NOTE = 20;

type Tab = "schedule" | "method" | "corrections";

export default function WorkdayAgreementsPage() {
  const [tab, setTab] = useState<Tab>("schedule");
  const [agreements, setAgreements] = useState<DistributionAgreement[]>([]);
  const [recordAgreements, setRecordAgreements] = useState<RecordAgreementAdmin[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; employeeNumber?: string | null }>>([]);
  const [form, setForm] = useState({ userId: "", withUnion: false, effectiveFrom: todayKey(), effectiveTo: "", evidenceText: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingCorrections, setPendingCorrections] = useState(0);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pendingAcceptance = agreements.filter((row) => !row.acceptedAt).length;
  const pendingSignature = recordAgreements.filter((row) => !row.employerAcceptedAt);
  const noteLength = form.evidenceText.trim().length;

  const create = async () => {
    setBusy("create");
    setError(null);
    try {
      await nomApi.createDistributionAgreement({
        userId: form.userId,
        kind: form.withUnion ? "COLECTIVO" : "INDIVIDUAL",
        party: form.withUnion ? "UNION" : "WORKER",
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        evidenceText: form.evidenceText,
      });
      setToast("Listo. La persona ya puede aceptarlo desde Mi jornada.");
      setForm((prev) => ({ ...prev, userId: "", evidenceText: "" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setBusy(null);
    }
  };

  const sign = async (ids: string[], key: string) => {
    setBusy(key);
    setError(null);
    let signed = 0;
    try {
      for (const id of ids) {
        await nomApi.signRecordAgreement(id);
        signed += 1;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo firmar.");
    } finally {
      if (signed > 0) setToast(signed === 1 ? "Firmado." : `${signed} firmados.`);
      await load();
      setBusy(null);
    }
  };

  return (
    <ITPage
      title="Acuerdos con el personal"
      description="Lo que cada persona acepta sobre su jornada: días más largos y la forma de registrar sus horas."
      icon={<LuSignature size={20} />}
      maxWidth="7xl"
      loading={loading}
    >
      <TabBar
        items={[
          { id: "schedule", label: `Jornada acordada${pendingAcceptance ? ` (${pendingAcceptance})` : ""}`, icon: <LuCalendarClock size={13} /> },
          { id: "method", label: `Forma de registro${pendingSignature.length ? ` (${pendingSignature.length})` : ""}`, icon: <LuFileCheck size={13} /> },
          { id: "corrections", label: `Correcciones de checadas${pendingCorrections ? ` (${pendingCorrections})` : ""}`, icon: <LuClockAlert size={13} /> },
        ] as TabBarItem<Tab>[]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-4 flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}

        {/* Montada siempre: su contador de pendientes vive en la pestaña. */}
        <div className={tab === "corrections" ? "flex flex-col gap-4" : "hidden"}>
          <PunchCorrections onPendingChange={setPendingCorrections} onDone={setToast} />
        </div>

        {tab === "schedule" && (
          <>
            <ITAlert variant="info">
              Úsalo cuando alguien trabaja unos días más largos a cambio de otros más cortos (art. 58 LFT). Con el acuerdo aceptado,
              esas horas cuentan como jornada normal; sin él, lo que pase del turno se calcula como tiempo extra.
            </ITAlert>

            <ITCard className="tm-hero-card tm-hero-card--mint" contentClassName="!p-5">
              <ITText className="font-bold">Nuevo acuerdo de jornada</ITText>
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
                <ITDatePicker
                  name="agreementPeriod"
                  label="Vigencia (sin fecha final = indefinida)"
                  range
                  value={[dateStrToLocal(form.effectiveFrom) ?? null, dateStrToLocal(form.effectiveTo) ?? null]}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!Array.isArray(value)) return;
                    const [from, to] = value;
                    setForm((prev) => ({
                      ...prev,
                      effectiveFrom: from ? localToDateStr(from) : "",
                      effectiveTo: to ? localToDateStr(to) : "",
                    }));
                  }}
                />
              </div>
              <div className="mt-3">
                <ITTextarea
                  name="agreementEvidence"
                  label="¿Qué se acordó? La persona leerá este texto antes de aceptar"
                  placeholder="Ej.: Lunes a jueves de 8:00 a 18:00 y viernes de 8:00 a 14:00, según acta firmada el 3 de noviembre."
                  value={form.evidenceText}
                  rows={3}
                  onChange={(value) => setForm((prev) => ({ ...prev, evidenceText: value }))}
                />
                {noteLength > 0 && noteLength < MIN_NOTE && (
                  <ITText muted className="mt-1 block !text-[11.5px]">Escribe un poco más de detalle (mínimo {MIN_NOTE} caracteres).</ITText>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ITCheckbox
                  name="agreementUnion"
                  label="Se acordó con el sindicato"
                  checked={form.withUnion}
                  onChange={(checked) => setForm((prev) => ({ ...prev, withUnion: checked }))}
                />
                <ITButton
                  variant="filled"
                  color="primary"
                  className="tm-save-button"
                  disabled={busy !== null || !form.userId || !form.effectiveFrom || noteLength < MIN_NOTE}
                  onClick={() => void create()}
                >
                  Guardar y pedir aceptación
                </ITButton>
              </div>
            </ITCard>

            <ITCard className="tm-hero-card tm-hero-card--sky" contentClassName="!p-5">
              <ITText className="font-bold">Acuerdos de jornada</ITText>
              <div className="mt-2 flex flex-col gap-2">
                {agreements.length === 0 && <TicState kind="empty" size="sm" title="Sin acuerdos de jornada" description="Si nadie trabaja días más largos de lo normal, no necesitas ninguno." />}
                {agreements.map((agreement) => (
                  <div key={agreement.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <ITText className="font-semibold !text-[13px]">
                        {agreement.user?.name ?? "—"}
                        {agreement.party === "UNION" ? " · con sindicato" : ""}
                      </ITText>
                      <ITText muted className="!text-[11.5px]">
                        Del {dayOf(agreement.effectiveFrom)} {agreement.effectiveTo ? `al ${dayOf(agreement.effectiveTo)}` : "en adelante"}
                      </ITText>
                    </div>
                    <ITBadget color={agreement.acceptedAt ? "success" : "warning"} size="sm">
                      {agreement.acceptedAt ? `Aceptado el ${dateOf(agreement.acceptedAt)}` : "Esperando que la persona acepte"}
                    </ITBadget>
                  </div>
                ))}
              </div>
            </ITCard>
          </>
        )}

        {tab === "method" && (
          <>
            <ITAlert variant="info">
              Cada persona acepta cómo se registran sus horas (reloj, web o app) la primera vez que entra a Mi jornada. Aquí la empresa
              firma de vuelta para que el acuerdo quede completo. No tienes que crear nada: solo firmar.
            </ITAlert>

            <ITCard className="tm-hero-card tm-hero-card--lavender" contentClassName="!p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <ITText className="font-bold">
                  {pendingSignature.length > 0 ? `${pendingSignature.length} por firmar` : "Todo firmado"}
                </ITText>
                {pendingSignature.length > 1 && (
                  <ITButton
                    variant="filled"
                    color="primary"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void sign(pendingSignature.map((row) => row.id), "all")}
                  >
                    Firmar todos
                  </ITButton>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {recordAgreements.length === 0 && <TicState kind="empty" size="sm" title="Nadie ha aceptado todavía" description="Aparecerán aquí conforme el personal entre a Mi jornada y acepte." />}
                {recordAgreements.map((agreement) => (
                  <div key={agreement.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <ITText className="font-semibold !text-[13px]">{agreement.user?.name ?? "—"}</ITText>
                      <ITText muted className="!text-[11.5px]">
                        {agreement.methods.map((method) => METHOD_LABEL[method] ?? method).join(" y ")} · aceptó el {dateOf(agreement.acceptedAt)}
                      </ITText>
                    </div>
                    {agreement.employerAcceptedAt ? (
                      <ITBadget color="success" size="sm">Firmado por la empresa</ITBadget>
                    ) : (
                      <ITButton variant="outlined" color="primary" size="sm" disabled={busy !== null} onClick={() => void sign([agreement.id], agreement.id)}>
                        Firmar
                      </ITButton>
                    )}
                  </div>
                ))}
              </div>
            </ITCard>
          </>
        )}
      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2800} onClose={() => setToast(null)} />}
    </ITPage>
  );
}

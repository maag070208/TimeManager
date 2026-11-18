import { useEffect, useState, type ReactNode } from "react";
import { ITAlert, ITButton, ITCheckbox, ITText, ITTextarea, ITToast, ITDatePicker } from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import {
  LuCalendarClock,
  LuCalendarRange,
  LuCircleCheck,
  LuClockAlert,
  LuDoorOpen,
  LuFingerprint,
  LuHourglass,
  LuPenLine,
  LuPlus,
  LuSignature,
  LuSmartphone,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { PunchCorrections } from "@features/nom/punch-corrections";
import { nomApi } from "@entities/nom";
import type { DistributionAgreement, RecordAgreementAdmin } from "@entities/nom";
import { usersApi } from "@entities/user";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
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
  const [creating, setCreating] = useState(false);

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

  const create = async (): Promise<boolean> => {
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
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
      return false;
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

  const activeAgreements = agreements.filter((row) => row.acceptedAt).length;
  const signedRecords = recordAgreements.length - pendingSignature.length;
  const sortedAgreements = [...agreements].sort((a, b) => Number(Boolean(a.acceptedAt)) - Number(Boolean(b.acceptedAt)));
  const sortedRecords = [...recordAgreements].sort((a, b) => Number(Boolean(a.employerAcceptedAt)) - Number(Boolean(b.employerAcceptedAt)));
  const closeForm = () => {
    setCreating(false);
    setForm((prev) => ({ ...prev, userId: "", evidenceText: "", effectiveTo: "", withUnion: false }));
  };

  return (
    <ITPage
      title="Acuerdos con el personal"
      description="Lo que la empresa y cada persona dejan por escrito sobre su horario y sus checadas. Elige un tema para ver qué hay pendiente."
      icon={<LuSignature size={20} />}
      maxWidth="7xl"
      loading={loading}
    >
      <div role="tablist" aria-label="Tipos de acuerdo" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TopicCard
          active={tab === "schedule"}
          onSelect={() => setTab("schedule")}
          icon={<LuCalendarClock size={14} />}
          title="Horarios con días largos"
          description="Alguien trabaja unos días más horas a cambio de otros más cortos (p. ej. lunes a jueves 10 h)."
          status={
            pendingAcceptance > 0
              ? { tone: "wait", text: `${pendingAcceptance} esperando que la persona acepte` }
              : activeAgreements > 0
                ? { tone: "ok", text: `${activeAgreements} ${activeAgreements === 1 ? "vigente" : "vigentes"}` }
                : { tone: "idle", text: "Ninguno registrado" }
          }
        />
        <TopicCard
          active={tab === "method"}
          onSelect={() => setTab("method")}
          icon={<LuFingerprint size={14} />}
          title="Cómo checa cada persona"
          description="Cada quien confirma si registra sus horas con el reloj, la web o la app, y la empresa firma de enterada."
          status={
            pendingSignature.length > 0
              ? { tone: "todo", text: `Te toca firmar ${pendingSignature.length}` }
              : recordAgreements.length > 0
                ? { tone: "ok", text: `${signedRecords} firmados · nada pendiente` }
                : { tone: "idle", text: "Nadie ha confirmado aún" }
          }
        />
        <TopicCard
          active={tab === "corrections"}
          onSelect={() => setTab("corrections")}
          icon={<LuClockAlert size={14} />}
          title="Checadas por corregir"
          description="Cuando alguien avisa que una checada salió mal (olvidó checar, hora equivocada)."
          status={pendingCorrections > 0 ? { tone: "todo", text: `Te toca revisar ${pendingCorrections}` } : { tone: "ok", text: "Nada por revisar" }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}

        {/* Montada siempre: su contador de pendientes vive en la tarjeta. */}
        <div className={tab === "corrections" ? "flex flex-col gap-4" : "hidden"}>
          <TopicGuide
            color="#0284c7"
            tone="sky"
            title="¿Alguien checó mal?"
            steps={[
              { who: "La persona", text: "avisa desde Mi jornada qué checada está mal y cuál era la hora correcta." },
              { who: "Tú", text: "revisas aquí y apruebas o rechazas.", yours: true },
              { who: "Resultado", text: "cuenta la hora corregida; la checada original se guarda sin cambios." },
            ]}
          />
          <PunchCorrections onPendingChange={setPendingCorrections} onDone={setToast} />
        </div>

        {tab === "schedule" && (
          <>
            <TopicGuide
              color="#059669"
              tone="mint"
              title="¿Alguien trabaja días más largos a cambio de otros?"
              note="Sin acuerdo, esas horas de más se cuentan como tiempo extra. Con acuerdo cuentan como jornada normal."
              steps={[
                { who: "Tú", text: "registras aquí con quién y qué horario se acordó.", yours: true },
                { who: "La persona", text: "lo lee y lo acepta desde Mi jornada." },
                { who: "Resultado", text: "esas horas cuentan como jornada normal, no como extra." },
              ]}
              action={
                !creating && (
                  <SolidAction color="#059669" icon={<LuPlus size={18} />} onClick={() => setCreating(true)}>
                    Registrar acuerdo
                  </SolidAction>
                )
              }
            />

            {creating && (
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <ITText className="!text-[10.5px] font-semibold uppercase tracking-[0.12em] !text-slate-500">Nuevo acuerdo</ITText>
                    <ITText className="!text-[17px] font-extrabold !text-slate-900">¿Con quién y qué se acordó?</ITText>
                  </div>
                  <button type="button" onClick={closeForm} aria-label="Cancelar" className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <LuX size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, (noteLength / MIN_NOTE) * 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-500">
                      {noteLength < MIN_NOTE ? `${noteLength}/${MIN_NOTE}` : "Listo"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
                    onClick={() => void create().then((ok) => ok && closeForm())}
                  >
                    Guardar y pedir aceptación
                  </ITButton>
                </div>
              </section>
            )}

            {agreements.length === 0 && !creating ? (
              <div className="dash-card rounded-2xl border bg-white py-6 shadow-sm" style={{ borderColor: "#eef1f5" }}>
                <TicState kind="empty" size="sm" title="No hay acuerdos registrados" description="Si todos trabajan el mismo horario cada día, no necesitas registrar nada aquí." />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sortedAgreements.map((agreement) => (
                  <PersonCard
                    key={agreement.id}
                    name={agreement.user?.name ?? "—"}
                    subtitle={agreement.user?.employeeNumber ? `#${agreement.user.employeeNumber}` : undefined}
                    pending={!agreement.acceptedAt}
                    status={agreement.acceptedAt ? "Aceptado" : "Esperando que acepte"}
                    footer={
                      <span className="inline-flex items-center gap-1.5">
                        <LuCalendarRange size={13} />
                        {dayOf(agreement.effectiveFrom)} {agreement.effectiveTo ? `→ ${dayOf(agreement.effectiveTo)}` : "→ indefinido"}
                      </span>
                    }
                  >
                    {agreement.party === "UNION" && (
                      <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                        <LuUsers size={11} /> Con sindicato
                      </span>
                    )}
                    <p className="line-clamp-3 text-[12.5px] leading-relaxed text-slate-600">“{agreement.evidenceText}”</p>
                    {agreement.acceptedAt && <p className="mt-1.5 text-[11.5px] text-slate-400">Aceptó el {dateOf(agreement.acceptedAt)}</p>}
                  </PersonCard>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "method" && (
          <>
            <TopicGuide
              color="#7c3aed"
              tone="lavender"
              title="¿Con qué registra sus horas cada persona?"
              steps={[
                { who: "La persona", text: "confirma en Mi jornada si checa con reloj, web o app." },
                { who: "Tú", text: "firmas aquí como empresa.", yours: true },
                { who: "Resultado", text: "queda constancia de cómo se lleva su registro de horas." },
              ]}
              action={
                pendingSignature.length > 0 && (
                  <SolidAction color="#7c3aed" icon={<LuSignature size={18} />} disabled={busy !== null} onClick={() => void sign(pendingSignature.map((row) => row.id), "all")}>
                    {pendingSignature.length === 1 ? "Firmar" : `Firmar todos (${pendingSignature.length})`}
                  </SolidAction>
                )
              }
            />

            {recordAgreements.length === 0 ? (
              <div className="dash-card rounded-2xl border bg-white py-6 shadow-sm" style={{ borderColor: "#eef1f5" }}>
                <TicState kind="empty" size="sm" title="Nadie ha confirmado todavía" description="Cada persona aparecerá aquí cuando confirme en Mi jornada cómo checa." />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sortedRecords.map((agreement) => (
                  <PersonCard
                    key={agreement.id}
                    name={agreement.user?.name ?? "—"}
                    pending={!agreement.employerAcceptedAt}
                    status={agreement.employerAcceptedAt ? "Firmado" : "Falta firma"}
                    footer={
                      agreement.employerAcceptedAt ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700">
                          <LuCircleCheck size={13} /> Firmado por la empresa
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void sign([agreement.id], agreement.id)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition hover:brightness-95 disabled:opacity-60"
                          style={{ backgroundColor: "#7c3aed", color: "#ffffff" }}
                        >
                          <LuPenLine size={14} /> Firmar como empresa
                        </button>
                      )
                    }
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {agreement.methods.map((method) => (
                        <span key={method} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11.5px] font-semibold text-slate-700">
                          {METHOD_ICON[method]} {METHOD_LABEL[method] ?? method}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11.5px] text-slate-400">Aceptó el {dateOf(agreement.acceptedAt)}</p>
                  </PersonCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2800} onClose={() => setToast(null)} />}
    </ITPage>
  );
}

const METHOD_ICON: Record<string, ReactNode> = {
  CLOCK: <LuFingerprint size={12} />,
  REMOTE: <LuSmartphone size={12} />,
  ACCESS: <LuDoorOpen size={12} />,
};

type StatusTone = "todo" | "wait" | "ok" | "idle";

const STATUS_STYLE: Record<StatusTone, { bg: string; fg: string; icon: ReactNode }> = {
  todo: { bg: "#fffbeb", fg: "#b45309", icon: <LuPenLine size={12} /> },
  wait: { bg: "#f0f9ff", fg: "#0369a1", icon: <LuHourglass size={12} /> },
  ok: { bg: "#ecfdf5", fg: "#047857", icon: <LuCircleCheck size={12} /> },
  idle: { bg: "#f8fafc", fg: "#64748b", icon: null },
};

/** Pestaña con explicación: qué es el tema y si hay algo pendiente. */
function TopicCard({
  active, onSelect, icon, title, description, status,
}: {
  active: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  status: { tone: StatusTone; text: string };
}) {
  const tone = STATUS_STYLE[status.tone];
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`tm-hero-card tm-hero-card--${active ? "mint" : "slate"} dash-card flex flex-col items-start gap-2 rounded-2xl p-4 pb-10 text-left transition ${active ? "shadow-md" : "hover:-translate-y-0.5 hover:shadow-md"}`}
    >
      <span className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={active ? { backgroundColor: "#ecfdf5", color: "#047857" } : { backgroundColor: "#f1f5f9", color: "#475569" }}>
          {icon}
        </span>
        {title}
      </span>
      <span className="text-[12.5px] leading-relaxed text-slate-600">{description}</span>
      <span
        className="mt-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {tone.icon}
        {status.text}
      </span>
    </button>
  );
}

/** Cómo funciona el tema en tres pasos; resalta el que le toca a RH. */
function TopicGuide({
  color, tone, title, note, steps, action,
}: {
  color: string;
  tone: "mint" | "lavender" | "sky";
  title: string;
  note?: string;
  steps: Array<{ who: string; text: string; yours?: boolean }>;
  action?: ReactNode;
}) {
  return (
    <section className={`tm-hero-card tm-hero-card--${tone} dash-card rounded-2xl p-5 pb-14`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Cómo funciona</p>
          <h2 className="mt-0.5 text-[18px] font-extrabold text-slate-900">{title}</h2>
          {note && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-600">{note}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.who + index}
            className="flex gap-3 rounded-xl p-3"
            style={step.yours ? { backgroundColor: "#ffffff", border: `1px solid ${color}55`, boxShadow: `0 10px 22px -18px ${color}` } : { backgroundColor: "rgba(255,255,255,0.8)", border: "1px solid #eef1f5" }}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
              style={step.yours ? { backgroundColor: color, color: "#ffffff" } : { backgroundColor: "#e2e8f0", color: "#475569" }}
            >
              {index + 1}
            </span>
            <p className="text-[12.5px] leading-relaxed text-slate-600">
              <span className="font-extrabold" style={{ color: step.yours ? color : "#0f172a" }}>{step.who}</span> {step.text}
              {step.yours && <span className="ml-1 text-[11px] font-bold" style={{ color }}>← aquí</span>}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Botón sólido de la acción principal (color en línea: el Tailwind del design system gana a las clases). */
function SolidAction({ color, icon, disabled, onClick, children }: { color: string; icon: ReactNode; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[14px] font-extrabold transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
      style={{ backgroundColor: color, color: "#ffffff", boxShadow: `0 12px 24px -14px ${color}` }}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>{icon}</span>
      {children}
    </button>
  );
}

/** Tarjeta de una persona: avatar, estado, contenido y pie. Las pendientes llevan acento ámbar. */
function PersonCard({
  name, subtitle, pending, status, footer, children,
}: {
  name: string;
  subtitle?: string;
  pending: boolean;
  status: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      className="flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "#eef1f5", borderLeft: `4px solid ${pending ? "#f59e0b" : "#10b981"}` }}
    >
      <header className="flex items-center gap-3">
        <ProfileAvatar name={name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-slate-900">{name}</p>
          {subtitle && <p className="text-[11.5px] text-slate-500">{subtitle}</p>}
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={pending ? { backgroundColor: "#fffbeb", color: "#b45309" } : { backgroundColor: "#ecfdf5", color: "#047857" }}
        >
          {pending ? <LuHourglass size={11} /> : <LuCircleCheck size={11} />} {status}
        </span>
      </header>
      <div className="mt-3 flex-1">{children}</div>
      <footer className="mt-3 border-t border-slate-100 pt-3 text-[12px] font-semibold text-slate-600">{footer}</footer>
    </article>
  );
}

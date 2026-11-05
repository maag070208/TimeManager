import {
  ITAlert,
  ITBadget,
  ITButton,
  ITChip,
  ITFlex,
  ITInput,
  ITLoader,
  ITText,
  ITToast,
} from "@axzydev/axzy_ui_system";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { FaLink, FaUnlink } from "react-icons/fa";
import type { User } from "@entities/user";
import { PanelCard } from "@shared/ui/panel-card";
import type { UseTimeClockDifferences } from "../model/useTimeClockDifferences";

interface FilaProps {
  seleccionada: boolean;
  onClick: () => void;
  /** Para poder elegir la columna en las pruebas sin depender del texto. */
  testid: string;
  children: React.ReactNode;
}

/**
 * Renglón clicable de cualquiera de las dos columnas. El `!bg-` es por el reset
 * del UI kit, que le gana a las utilidades de Tailwind en los `<button>`.
 */
function Fila({ seleccionada, onClick, testid, children }: FilaProps) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition ${
        seleccionada
          ? "border-primary-500 !bg-primary-500/5"
          : "border-slate-200 !bg-[var(--it-card-bg)] hover:border-slate-300 hover:!bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Conciliación en dos columnas: a la izquierda los números que vieron los
 * relojes, a la derecha las personas del sistema. Un clic de cada lado y la
 * barra de abajo confirma; nada se guarda hasta entonces.
 */
export default function TimeClockDifferencesTab({ fx }: { fx: UseTimeClockDifferences }) {
  const {
    t,
    canLink,
    loading,
    saving,
    error,
    setError,
    toast,
    setToast,
    qClock,
    setQClock,
    qPerson,
    setQPerson,
    onlyMissing,
    setOnlyMissing,
    onlyFree,
    setOnlyFree,
    clockVisible,
    peopleVisible,
    missing,
    free,
    asignados,
    yaAsignadaA,
    clockSel,
    setClockSel,
    personSel,
    setPersonSel,
    cancelar,
    asignar,
    desvincular,
  } = fx;

  if (loading) return <ITLoader size="md" />;

  return (
    <ITFlex direction="column" gap={4}>
      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}
      {!canLink && <ITAlert variant="info">{t("differences.readOnly")}</ITAlert>}

      <ITText className="text-[12px] text-slate-500">
        {t("differences.summary", { missing, free })}
      </ITText>

      <div className="!grid gap-4 lg:!grid-cols-2">
        {/* Lo que vio el reloj */}
        <PanelCard title={`${t("differences.clock.title")} · ${clockVisible.length}`}>
          <ITFlex direction="column" gap={3}>
            <ITFlex align="center" wrap="wrap" gap={2}>
              <ITFlex className="min-w-0 flex-1">
                <ITInput
                  name="diferenciasReloj"
                  placeholder={t("differences.clock.search")}
                  value={qClock}
                  onChange={(e) => setQClock(e.target.value)}
                  className="w-full min-w-0"
                />
              </ITFlex>
              <ITChip
                label={t("differences.clock.onlyMissing")}
                selected={onlyMissing}
                onClick={() => setOnlyMissing(!onlyMissing)}
                color="primary"
                variant="outlined"
                size="sm"
              />
            </ITFlex>

            <ITFlex direction="column" gap={2} className="max-h-[440px] overflow-y-auto pr-1">
              {clockVisible.map((r) => (
                <Fila
                  key={r.employeeNumber}
                  testid="fila-reloj"
                  seleccionada={clockSel?.employeeNumber === r.employeeNumber}
                  onClick={() => setClockSel(r)}
                >
                  <ITFlex align="center" justify="between" gap={2}>
                    <ProfileAvatar name={r.name} size="sm" />
                    <ITFlex direction="column" gap={0.5} className="min-w-0">
                      <ITFlex align="center" gap={2} className="min-w-0">
                        <ITText className="text-[12px] font-black whitespace-nowrap text-slate-800">
                          #{r.employeeNumber}
                        </ITText>
                        <ITText className="truncate text-[12px] font-bold text-slate-600">
                          {r.name}
                        </ITText>
                      </ITFlex>
                      <ITText className="text-[10px] text-slate-400">
                        {t("differences.clock.punches", { count: r.punches })}
                        {r.link
                          ? ` · ${r.link.name}`
                          : r.suggestion
                            ? ` · ${t("employees.suggestion")}: ${r.suggestion.name}`
                            : ""}
                      </ITText>
                    </ITFlex>
                    <ITBadget color={r.link ? "success" : "gray"} size="sm">
                      {r.link
                        ? t("employees.statuses.LINKED")
                        : t("employees.statuses.UNLINKED")}
                    </ITBadget>
                  </ITFlex>
                </Fila>
              ))}
              {clockVisible.length === 0 && (
                <ITText className="text-[11px] text-slate-400">
                  {t("differences.clock.empty")}
                </ITText>
              )}
            </ITFlex>
          </ITFlex>
        </PanelCard>

        {/* Las personas del sistema */}
        <PanelCard title={`${t("differences.people.title")} · ${peopleVisible.length}`}>
          <ITFlex direction="column" gap={3}>
            <ITFlex align="center" wrap="wrap" gap={2}>
              <ITFlex className="min-w-0 flex-1">
                <ITInput
                  name="diferenciasPersona"
                  placeholder={t("differences.people.search")}
                  value={qPerson}
                  onChange={(e) => setQPerson(e.target.value)}
                  className="w-full min-w-0"
                />
              </ITFlex>
              <ITChip
                label={t("differences.people.onlyFree")}
                selected={onlyFree}
                onClick={() => setOnlyFree(!onlyFree)}
                color="primary"
                variant="outlined"
                size="sm"
              />
            </ITFlex>

            <ITFlex direction="column" gap={2} className="max-h-[440px] overflow-y-auto pr-1">
              {peopleVisible.map((p: User) => {
                const numeros = asignados.get(p.id) ?? [];
                return (
                  <Fila
                    key={p.id}
                    testid="fila-persona"
                    seleccionada={personSel?.id === p.id}
                    onClick={() => setPersonSel(p)}
                  >
                    <ITFlex align="center" justify="between" gap={2}>
                      <ProfileAvatar name={p.name} size="sm" />
                      <ITFlex direction="column" gap={0.5} className="min-w-0">
                        <ITText className="truncate text-[12px] font-bold text-slate-800">
                          {p.name}
                        </ITText>
                        <ITText className="text-[10px] text-slate-400">
                          {p.employeeNumber ? `#${p.employeeNumber}` : "—"}
                        </ITText>
                      </ITFlex>
                      {numeros.length > 0 && (
                        <ITBadget color="success" size="sm">
                          {t("differences.people.assigned", { number: numeros.join(", ") })}
                        </ITBadget>
                      )}
                    </ITFlex>
                  </Fila>
                );
              })}
              {peopleVisible.length === 0 && (
                <ITText className="text-[11px] text-slate-400">
                  {t("differences.people.empty")}
                </ITText>
              )}
            </ITFlex>
          </ITFlex>
        </PanelCard>
      </div>

      {/* La confirmación: hasta aquí no se ha escrito nada. */}
      <PanelCard>
        <ITFlex align="center" justify="between" wrap="wrap" gap={3}>
          <ITFlex direction="column" gap={0.5} className="min-w-0">
            {clockSel ? (
              <ITText className="text-[12px] font-black text-slate-800">
                #{clockSel.employeeNumber} · {clockSel.name}
                {clockSel.link ? ` → ${clockSel.link.name}` : ""}
              </ITText>
            ) : (
              <ITText className="text-[12px] text-slate-400">
                {t("differences.action.pickClock")}
              </ITText>
            )}
            <ITText className="text-[11px] text-slate-500">
              {personSel
                ? `${personSel.name}${personSel.employeeNumber ? ` · #${personSel.employeeNumber}` : ""}`
                : t("differences.action.pickPerson")}
            </ITText>
            {personSel && yaAsignadaA.length > 0 && (
              <ITText className="text-[11px] font-bold text-amber-600">
                {t("differences.action.assignedWarning", {
                  name: personSel.name,
                  number: yaAsignadaA.join(", "),
                })}
              </ITText>
            )}
          </ITFlex>

          {canLink && (
            <ITFlex align="center" wrap="wrap" gap={2}>
              <ITButton
                variant="filled"
                color="primary"
                disabled={!clockSel || !personSel || saving}
                onClick={() => void asignar()}
              >
                <ITFlex align="center" gap={1}>
                  <FaLink size={11} />
                  <ITText className="font-bold text-[11px]">
                    {clockSel?.link ? t("differences.action.change") : t("differences.action.assign")}
                  </ITText>
                </ITFlex>
              </ITButton>
              {clockSel?.link && (
                <ITButton
                  variant="outlined"
                  color="danger"
                  disabled={saving}
                  onClick={() => void desvincular()}
                >
                  <ITFlex align="center" gap={1}>
                    <FaUnlink size={11} />
                    <ITText className="font-bold text-[11px]">
                      {t("differences.action.unlink")}
                    </ITText>
                  </ITFlex>
                </ITButton>
              )}
              {(clockSel || personSel) && (
                <ITButton variant="text" color="gray" onClick={cancelar}>
                  <ITText className="font-bold text-[11px]">
                    {t("differences.action.cancel")}
                  </ITText>
                </ITButton>
              )}
            </ITFlex>
          )}
        </ITFlex>
      </PanelCard>

      {toast && (
        <ITToast
          message={toast}
          type="success"
          position="top-right"
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}
    </ITFlex>
  );
}

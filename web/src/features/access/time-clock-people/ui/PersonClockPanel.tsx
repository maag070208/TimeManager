import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaClock, FaFingerprint, FaIdCard, FaUserCheck } from "react-icons/fa";
import { dateLocale } from "@shared/i18n/format";
import { timeClockApi, type TimeClockPersonDetail, type TimeClockPunch } from "@entities/time-clock";
import { ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";


interface Props {
  clockSerial: string;
  employeeNumber: string;
  /** Permite quitar tarjetas (escribe en el reloj; la API aplica su candado). */
  editable?: boolean;
  onChanged?: () => void;
  /** Contenido de la columna izquierda (el panel de huellas), junto a las checadas. */
  aside?: React.ReactNode;
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <ITText as="span" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--it-card-bg)] text-slate-500 shadow-sm">{icon}</ITText>
      <div>
        <ITText className="text-xl font-black leading-none text-slate-900">{value}</ITText>
        <ITText className="mt-1 text-[12px] font-semibold text-slate-400">{label}</ITText>
      </div>
    </div>
  );
}

/**
 * Datos de la persona en un reloj, sin repetir lo que ya muestra el encabezado de la ficha
 * (foto, nombre y número): indicadores, vínculo, tarjetas y huellas.
 */
export default function PersonClockPanel({ clockSerial, employeeNumber, editable = false, onChanged, aside }: Props) {
  const { t } = useTranslation("time-clock");
  const [detail, setDetail] = useState<TimeClockPersonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [punches, setPunches] = useState<TimeClockPunch[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    timeClockApi
      .personDetail(clockSerial, employeeNumber)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t("employeeClock.summary.error")));
  }, [clockSerial, employeeNumber, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Checadas de esta persona (todas las de ese número, más recientes primero).
  useEffect(() => {
    let cancelled = false;
    timeClockApi
      .table({ page: 1, limit: 30, filters: { employeeNumber }, sort: { key: "occurredAt", direction: "desc" } })
      .then((r) => !cancelled && setPunches(r.data))
      .catch(() => !cancelled && setPunches([]));
    return () => {
      cancelled = true;
    };
  }, [employeeNumber]);

  const write = async (action: () => Promise<unknown>, failMessage: string, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
      load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : failMessage);
    } finally {
      setBusy(false);
    }
  };

  if (error && !detail) return <ITText role="alert" className="text-sm text-red-600">{error}</ITText>;
  if (!detail) return <ITText className="text-sm text-slate-400">{t("employeeClock.summary.loading")}</ITText>;

  return (
    <ITStack spacing={5}>
      {error && <ITText role="alert" className="text-sm text-red-600">{error}</ITText>}
      <div className="grid grid-cols-2 gap-3 lg:!grid-cols-4">
        <Tile icon={<FaUserCheck size={14} />} label={t("employeeClock.tiles.faces")} value={detail.faces.count} />
        <Tile icon={<FaFingerprint size={14} />} label={t("employeeClock.tiles.fingers")} value={detail.fingerprints.length} />
        <Tile icon={<FaIdCard size={14} />} label={t("employeeClock.tiles.cards")} value={detail.cards.length} />
        <Tile icon={<FaClock size={14} />} label={t("employeeClock.tiles.punches")} value={detail.punchesToday} />
      </div>

      {detail.cards.length > 0 && (
        <section>
          <ITText as="h4" className="mb-2 text-xs font-bold text-slate-500">{t("person.cards")}</ITText>
          <ITFlex wrap="wrap" gap={2}>
            {detail.cards.map((c) => (
              <ITText as="span" key={c} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 font-mono text-xs text-slate-800">
                {c}
                {editable && (
                  <button type="button" className="text-slate-300 hover:text-red-600" disabled={busy} title={t("people.actions.removeCard")}
                    onClick={() => void write(() => timeClockApi.peopleRemoveCard(clockSerial, c), t("people.errors.removeCard"))}>
                    ×
                  </button>
                )}
              </ITText>
            ))}
          </ITFlex>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-6 md:!grid-cols-2">
        <ITFlex className="min-w-0">{aside}</ITFlex>
        <section className="min-w-0 rounded-2xl border border-slate-200">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <ITText as="h4" className="text-sm font-semibold text-slate-700">{t("person.punches")}</ITText>
            <ITText as="span" className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">{punches?.length ?? 0}</ITText>
          </header>
          <div className="max-h-[22rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--it-card-bg)] text-left text-[10px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-semibold">{t("person.punchDate")}</th>
                  <th className="px-3 py-2 font-semibold">{t("person.punchTime")}</th>
                  <th className="px-3 py-2 font-semibold">{t("person.punchMethod")}</th>
                </tr>
              </thead>
              <tbody>
                {(punches ?? []).map((p) => {
                  const when = new Date(p.occurredAt);
                  return (
                    <tr key={p.id} className="border-t border-slate-50">
                      <td className="px-5 py-2 text-slate-700">{when.toLocaleDateString(dateLocale(), { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{when.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-3 py-2">
                        <ITText as="span" className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {t(`methods.${p.method}`, { defaultValue: p.method })}
                        </ITText>
                      </td>
                    </tr>
                  );
                })}
                {punches !== null && punches.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-400">{t("person.noPunches")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ITStack>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ITDialog, ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";
import { timeClockApi, type TimeClockPersonDetail } from "@entities/time-clock";

const field = "rounded-lg border border-slate-200 bg-[var(--it-card-bg)] px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none";
const primary = "cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400";
const ghost = "cursor-pointer rounded-full border border-slate-200 bg-[var(--it-card-bg)] px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50";
const danger = "cursor-pointer rounded-full border border-red-200 bg-[var(--it-card-bg)] px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50";

interface Props {
  clockSerial: string;
  employeeNumber: string;
  onClose: () => void;
  /** Muestra renombrar y tarjetas. Cada cambio escribe en el reloj (la API aplica su candado). */
  editable?: boolean;
  /** Avisa a la pantalla que llamó para que refresque su lista. */
  onChanged?: () => void;
}

/** Ficha de una persona del reloj como modal: foto, vínculo, tarjetas, huellas (solo tipo y número) y checadas de hoy. */
export default function PersonDetailDialog(props: Props) {
  const { t } = useTranslation("time-clock");
  return (
    <ITDialog isOpen onClose={props.onClose} title={t("person.title")} className="max-w-3xl">
      <PersonDetailBody {...props} />
    </ITDialog>
  );
}

function PersonDetailBody({ clockSerial, employeeNumber, editable = false, onChanged }: Omit<Props, "onClose">) {
  const { t } = useTranslation("time-clock");
  const [detail, setDetail] = useState<TimeClockPersonDetail | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newCard, setNewCard] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDetail = useCallback(() => {
    timeClockApi
      .personDetail(clockSerial, employeeNumber)
      .then(setDetail)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t("person.errors.read")));
  }, [clockSerial, employeeNumber, t]);

  useEffect(() => {
    let url: string | null = null;
    setDetail(null);
    setPhoto(null);
    setError(null);
    setRenaming(null);
    loadDetail();
    timeClockApi
      .personPhoto(clockSerial, employeeNumber)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setPhoto(url);
      })
      .catch(() => setPhoto(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [clockSerial, employeeNumber, loadDetail]);

  /** Ejecuta una escritura, refresca la ficha y la lista de la pantalla. */
  const write = async (action: () => Promise<unknown>, failMessage: string, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
      loadDetail();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : failMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ITStack spacing={4}>
      {error && <ITText role="alert" className="text-sm text-red-600">{error}</ITText>}
      {!detail && !error && <ITText className="text-sm text-slate-400">{t("person.loading")}</ITText>}
      {detail && (
        <div className="grid grid-cols-1 gap-5 md:!grid-cols-[180px_1fr]">
          <ITStack alignItems="center" spacing={2}>
            {photo ? (
              <img src={photo} alt={detail.name} className="h-44 w-36 rounded-xl border border-slate-200 object-cover" />
            ) : (
              <div className="flex h-44 w-36 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                {t("person.noPhoto")}
              </div>
            )}
          </ITStack>
          <ITStack spacing={4}>
            <ITFlex align="start" justify="between" wrap="wrap" gap={3}>
              {renaming !== null ? (
                <ITFlex align="end" wrap="wrap" gap={2}>
                  <input className={field} value={renaming} maxLength={64} onChange={(e) => setRenaming(e.target.value)} />
                  <button type="button" className={primary} disabled={busy || renaming.trim().length < 2}
                    onClick={() => void write(() => timeClockApi.peopleRename(clockSerial, employeeNumber, renaming.trim()), t("people.errors.rename"), () => setRenaming(null))}>
                    {t("people.actions.save")}
                  </button>
                  <button type="button" className={ghost} onClick={() => setRenaming(null)}>{t("people.actions.cancel")}</button>
                </ITFlex>
              ) : (
                <div>
                  <div className="text-lg font-bold text-slate-900">{detail.name}</div>
                  <div className="font-mono text-xs text-slate-500">{t("person.number")}: {detail.employeeNumber}</div>
                </div>
              )}
              {editable && renaming === null && (
                <button type="button" className={ghost} disabled={busy} onClick={() => setRenaming(detail.name)}>
                  {t("people.actions.rename")}
                </button>
              )}
            </ITFlex>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">{t("person.link")}</dt>
                <dd className="text-slate-900">
                  {detail.link ? detail.link.userName : t("person.notLinked")}
                  {detail.link && !detail.link.userActive && <ITText as="span" className="ml-2 text-xs text-red-600">{t("person.inactive")}</ITText>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("person.punchesToday")}</dt>
                <dd className="font-semibold text-slate-900">{detail.punchesToday}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("person.faces")}</dt>
                <dd className="font-semibold text-slate-900">{detail.faces.count}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("person.cards")}</dt>
                <dd className="font-semibold text-slate-900">{detail.cards.length}</dd>
              </div>
            </dl>

            <div>
              <div className="mb-2 text-xs font-semibold text-slate-500">{t("person.cards")}</div>
              <ITStack spacing={2}>
                {detail.cards.length === 0 && <ITText as="span" className="text-sm text-slate-400">{t("people.noCards")}</ITText>}
                {detail.cards.map((c) => (
                  <div key={c} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <ITText as="span" className="font-mono text-sm text-slate-800">{c}</ITText>
                    {editable && (
                      <button type="button" className={danger} disabled={busy}
                        onClick={() => void write(() => timeClockApi.peopleRemoveCard(clockSerial, c), t("people.errors.removeCard"))}>
                        {t("people.actions.removeCard")}
                      </button>
                    )}
                  </div>
                ))}
                {editable && (
                  <ITFlex align="end" gap={2}>
                    <ITText as="label" className="flex flex-col gap-1 text-xs text-slate-500">
                      {t("people.form.cardNo")}
                      <input className={field} inputMode="numeric" value={newCard} maxLength={20}
                        onChange={(e) => setNewCard(e.target.value.replace(/\D/g, ""))} />
                    </ITText>
                    <button type="button" className={primary} disabled={busy || newCard.length === 0}
                      onClick={() => void write(() => timeClockApi.peopleAddCard(clockSerial, employeeNumber, newCard), t("people.errors.addCard"), () => setNewCard(""))}>
                      {t("people.actions.addCard")}
                    </button>
                  </ITFlex>
                )}
              </ITStack>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold text-slate-500">{t("person.fingerprints")}</div>
              {detail.fingerprints.length === 0 ? (
                <ITText as="span" className="text-sm text-slate-400">{t("person.noFingerprints")}</ITText>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {detail.fingerprints.map((f) => (
                    <li key={f.fingerPrintID} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">
                      {t("person.finger", { id: f.fingerPrintID })}{f.fingerType ? ` · ${f.fingerType}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ITStack>
        </div>
      )}
    </ITStack>
  );
}

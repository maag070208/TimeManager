import { useState } from "react";
import { ITAlert, ITButton, ITTextarea } from "@axzydev/axzy_ui_system";
import { LuFileText, LuPenLine, LuShieldCheck, LuUpload } from "react-icons/lu";
import { nomApi, type PrivacyConsentSummary } from "@entities/nom";
import { TicState } from "@shared/ui/tic";
import { PersonCard, SolidAction, TopicGuide } from "./agreements-parts";
import { errorMessage } from "@shared/api/errors";

const COLOR = "#7c3aed";
const MIN_TEXT = 200;
const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

interface Props {
  summary: PrivacyConsentSummary | null;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Aviso de privacidad del cliente para todo su personal: RH lo publica (con
 * plantilla), cada persona lo acepta en Mi jornada antes de checar y aquí se ve
 * quién falta. Cambiar el texto sube la versión y se vuelve a pedir.
 */
export default function PrivacyNoticeTab({ summary, onSaved, onError }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notice = summary?.notice ?? null;
  const editing = draft !== null;
  const length = draft?.trim().length ?? 0;

  const loadTemplate = async () => {
    setBusy(true);
    try {
      const { template } = await nomApi.privacyTemplate();
      setDraft(template);
    } catch (cause) {
      onError(errorMessage(cause, "No se pudo cargar la plantilla."));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (draft === null) return;
    setBusy(true);
    try {
      await nomApi.updateTeleworkPolicy({ privacyNotice: draft.trim() });
      setDraft(null);
      onSaved(notice ? "Aviso actualizado. Todo el personal debe aceptarlo de nuevo." : "Aviso publicado. Cada persona lo verá en Mi jornada.");
    } catch (cause) {
      onError(errorMessage(cause, "No se pudo guardar el aviso."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopicGuide
        color={COLOR}
        tone="lavender"
        title="¿Tu personal sabe cómo usas sus datos?"
        note="La ley exige su consentimiento expreso para la huella, el rostro y la ubicación al checar. Sin aviso aceptado, la checada web o app de esa persona se guarda sin ubicación."
        steps={[
          { who: "Tú", text: "publicas el aviso de tu empresa; puedes partir de la plantilla.", yours: true },
          { who: "La persona", text: "lo lee y lo acepta en Mi jornada antes de checar." },
          { who: "Resultado", text: "queda constancia con fecha y versión; si cambias el texto, se vuelve a pedir." },
        ]}
        action={
          !editing && (
            <SolidAction color={COLOR} icon={notice ? <LuPenLine size={18} /> : <LuUpload size={18} />} onClick={() => setDraft(notice ?? "")}>
              {notice ? "Editar aviso" : "Publicar aviso"}
            </SolidAction>
          )
        }
      />

      {editing && (
        <section className="dash-card rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "#eef1f5" }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-extrabold text-slate-900">{notice ? "Editar el aviso" : "Nuevo aviso de privacidad"}</p>
            <ITButton variant="outlined" color="secondary" size="sm" disabled={busy} onClick={() => void loadTemplate()}>
              <span className="inline-flex items-center gap-1.5"><LuFileText size={13} /> Usar plantilla</span>
            </ITButton>
          </div>
          <ITAlert variant="info">
            La plantilla trae lo que pide la ley; llena lo que va entre [corchetes] con los datos de tu empresa. El texto y su
            validez legal son responsabilidad de tu empresa: revísalo con tu asesor.
          </ITAlert>
          <div className="mt-3">
            <ITTextarea name="privacyNotice" label="Texto del aviso" value={draft ?? ""} rows={14} onChange={(value) => setDraft(value)} />
            {draft?.includes("[") && (
              <p className="mt-1.5 text-[11.5px] font-semibold text-amber-700">Aún hay datos entre [corchetes] por llenar.</p>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "#eef1f5" }}>
            <p className="text-[12px] text-slate-500">
              {notice ? "Al guardar, todo el personal tendrá que aceptarlo de nuevo." : "Al publicarlo, cada persona lo verá en Mi jornada."}
            </p>
            <div className="flex gap-2">
              <ITButton variant="outlined" color="secondary" disabled={busy} onClick={() => setDraft(null)}>Cancelar</ITButton>
              <ITButton variant="filled" color="primary" className="tm-save-button" disabled={busy || length < MIN_TEXT || draft?.trim() === notice} onClick={() => void save()}>
                {notice ? "Guardar y volver a pedir" : "Publicar y pedir aceptación"}
              </ITButton>
            </div>
          </div>
        </section>
      )}

      {!notice && !editing ? (
        <div className="dash-card rounded-2xl border bg-white py-6 shadow-sm" style={{ borderColor: "#eef1f5" }}>
          <TicState kind="empty" size="sm" title="Aún no publicas tu aviso de privacidad" description="Publícalo para que tu personal lo acepte antes de checar." />
        </div>
      ) : (
        notice && (
          <>
            <p className="text-[12.5px] font-semibold text-slate-600">
              Versión {summary?.version} · {summary?.accepted} de {(summary?.accepted ?? 0) + (summary?.pending ?? 0)} personas lo aceptaron
              {summary?.updatedAt ? ` · publicada el ${dateOf(summary.updatedAt)}` : ""}
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summary?.people.map((person) => (
                <PersonCard
                  key={person.userId}
                  name={person.name}
                  subtitle={person.employeeNumber ? `#${person.employeeNumber}` : undefined}
                  pending={!person.acceptedAt}
                  status={person.acceptedAt ? "Aceptado" : "Falta aceptar"}
                  footer={
                    <span className="inline-flex items-center gap-1.5">
                      <LuShieldCheck size={13} />
                      {person.acceptedAt ? `Aceptó el ${dateOf(person.acceptedAt)}` : "Lo verá al entrar a Mi jornada"}
                    </span>
                  }
                >
                  <p className="text-[12px] text-slate-500">
                    {person.acceptedAt ? "Su checada web o app guarda ubicación." : "Mientras no lo acepte, su checada web o app se guarda sin ubicación."}
                  </p>
                </PersonCard>
              ))}
            </div>
          </>
        )
      )}
    </>
  );
}

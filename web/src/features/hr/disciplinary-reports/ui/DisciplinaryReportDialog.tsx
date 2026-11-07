import { useState } from "react";
import {
  ITDatePicker,
  ITDialog,
  ITFlex,
  ITSearchSelect,
  ITText,
  ITTextarea,
  ITButton,
  ITAlert,
} from "@axzydev/axzy_ui_system";
import { LuScrollText } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { personalApi, type DisciplinaryReason } from "@entities/hr";
import { usePeopleOptions } from "@entities/user";
import { DialogHeader } from "@shared/ui/dialog-header";
import { HelpTip } from "@shared/ui/help-tip";
import { DISCIPLINARY_REASONS } from "../model/useDisciplinaryReports";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Alta manual de un acta: empleado, motivo, fecha, hechos y sanción. */
export default function DisciplinaryReportDialog({ isOpen, onClose, onCreated }: Props) {
  const { t } = useTranslation(["disciplinary-reports", "common"]);
  const people = usePeopleOptions();
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState<DisciplinaryReason>("ABSENCE");
  const [incidentDate, setIncidentDate] = useState(() => new Date());
  const [description, setDescription] = useState("");
  const [sanction, setSanction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setUserId("");
    setReason("ABSENCE");
    setIncidentDate(new Date());
    setDescription("");
    setSanction("");
    setError(null);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!userId) return setError(t("form.emptyEmployee"));
    if (description.trim().length < 5) return setError(t("form.emptyDescription"));
    setSaving(true);
    setError(null);
    try {
      await personalApi.createDisciplinaryReport({
        userId,
        reason,
        incidentDate: toIso(incidentDate),
        description: description.trim(),
        sanction: sanction.trim() || undefined,
      });
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ITDialog isOpen={isOpen} onClose={close} className="max-w-2xl">
      <DialogHeader
        icon={<LuScrollText size={20} />}
        title={t("form.title")}
        subtitle={t("description")}
      />
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
        {error && (
          <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </ITAlert>
        )}

        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <ITFlex align="center" gap={2} className="mb-3">
            <ITText as="h3" className="m-0 !text-[13px] font-bold !text-slate-800">Incidente</ITText>
            <HelpTip text="El acta se asienta sobre hechos concretos. El empleado debe tener expediente activo." />
          </ITFlex>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ITSearchSelect
                name="disciplinaryEmployee"
                label={t("form.employee")}
                placeholder={t("form.employeeHint")}
                options={(people.data as never) ?? []}
                valueField="id"
                labelField="name"
                value={userId}
                onChange={(value) => setUserId(String(value))}
                required
              />
            </div>
            <ITSearchSelect
              name="disciplinaryReason"
              label={t("form.reason")}
              options={DISCIPLINARY_REASONS.map((value) => ({
                value,
                label: t(`reasons.${value}`),
              }))}
              value={reason}
              onChange={(value) => setReason(String(value) as DisciplinaryReason)}
              required
            />
            <ITDatePicker
              name="disciplinaryDate"
              label={t("form.incidentDate")}
              value={incidentDate}
              onChange={(event) => {
                const next = event.target.value;
                if (next instanceof Date) setIncidentDate(next);
              }}
              maxDate={new Date()}
              required
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <ITFlex align="center" gap={2} className="mb-3">
            <ITText as="h3" className="m-0 !text-[13px] font-bold !text-slate-800">Detalle</ITText>
            <HelpTip text="Describe qué pasó, cuándo y quién estuvo presente. Evita adjetivos y juicios." />
          </ITFlex>
          <div className="flex flex-col gap-4">
            <ITTextarea
              name="disciplinaryDescription"
              label={t("form.description")}
              placeholder={t("form.descriptionHint")}
              rows={4}
              value={description}
              onChange={(value) => setDescription(value)}
            />
            <ITTextarea
              name="disciplinarySanction"
              label={t("form.sanction")}
              placeholder={t("form.sanctionHint")}
              rows={2}
              value={sanction}
              onChange={(value) => setSanction(value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <ITButton variant="outlined" color="secondary" className="tm-save-button" onClick={close} disabled={saving}>
          {t("common:actions.cancel")}
        </ITButton>
        <ITButton variant="filled" color="primary" className="tm-save-button" onClick={() => void submit()} disabled={saving}>
          {saving ? t("form.saving") : t("form.save")}
        </ITButton>
      </div>
    </ITDialog>
  );
}

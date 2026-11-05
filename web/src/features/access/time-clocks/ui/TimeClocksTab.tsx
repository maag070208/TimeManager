import { useState } from "react";
import {
  ITAlert,
  ITButton,
  ITCard,
  ITCheckbox,
  ITDialog,
  ITFlex,
  ITInput,
  ITText,
  ITToast,
} from "@axzydev/axzy_ui_system";
import { FaLock, FaPlus } from "react-icons/fa";
import type { TimeClockDevice } from "@entities/time-clock";
import type { UseTimeClocks } from "../model/useTimeClocks";
import ClockCard from "./ClockCard";
import ClockDetail from "./ClockDetail";

/**
 * Relojes checadores: lista en tarjetas y, al entrar a una, el detalle con su
 * sincronización, su configuración leída en vivo y las acciones. Del reloj solo
 * se lee; nada de esta pantalla le cambia algo al equipo.
 */
export default function TimeClocksTab({ fx }: { fx: UseTimeClocks }) {
  const {
    t,
    status,
    configs,
    loadConfig,
    isRegistrationOpen,
    setIsRegistrationOpen,
    openRegistration,
    url,
    setUrl,
    name,
    setName,
    countsAttendance,
    setAttendance,
    connecting,
    registrationError,
    register,
    editTarget,
    setEditTarget,
    editName,
    setEditName,
    editAttendance,
    setEditAttendance,
    editWrite,
    setEditWrite,
    saving,
    editError,
    saveEdit,
    retirementTarget,
    setRetirementTarget,
    retiring,
    confirmRetirement,
    error,
    setError,
    toast,
    setToast,
  } = fx;

  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);

  const clocks = status?.devices ?? [];
  const selected = selectedSerial
    ? clocks.find((clock) => clock.clockSerial === selectedSerial) ?? null
    : null;

  const openClock = (clock: TimeClockDevice) => {
    setSelectedSerial(clock.clockSerial);
    void loadConfig(clock.clockSerial);
  };

  return (
    <ITFlex direction="column" gap={4}>
      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}

      {selected ? (
        <ClockDetail
          fx={fx}
          clock={selected}
          config={configs[selected.clockSerial]}
          onBack={() => setSelectedSerial(null)}
        />
      ) : (
        <>
          <ITCard className="!p-5">
            <ITFlex align="center" wrap="wrap" gap={3}>
              <ITFlex direction="column" gap={1} className="min-w-0">
                <ITFlex align="center" gap={1}>
                  <FaLock size={11} className="text-slate-400" />
                  <ITText className="text-[12px] font-bold text-slate-700">
                    {t("clocks.readOnly")}
                  </ITText>
                </ITFlex>
                <ITText className="text-[11px] text-slate-500">
                  {t("clocks.credentials")}
                </ITText>
              </ITFlex>
              <ITButton
                variant="filled"
                color="primary"
                size="sm"
                className="ml-auto"
                disabled={!status?.configured}
                onClick={openRegistration}
              >
                <ITFlex align="center" gap={1}>
                  <FaPlus size={10} />
                  <ITText className="font-bold text-[11px]">
                    {t("clocks.actions.registration")}
                  </ITText>
                </ITFlex>
              </ITButton>
            </ITFlex>
          </ITCard>

          {status && !status.configured && (
            <ITAlert variant="warning">{t("clocks.notConfigured")}</ITAlert>
          )}

          {status && clocks.length === 0 ? (
            <ITCard className="!p-5">
              <ITText className="text-[12px] text-slate-500">{t("clocks.empty")}</ITText>
            </ITCard>
          ) : (
            <div className="grid gap-4 sm:!grid-cols-2 xl:!grid-cols-3">
              {clocks.map((clock) => (
                <ClockCard
                  key={clock.clockSerial}
                  fx={fx}
                  clock={clock}
                  onOpen={() => openClock(clock)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ITDialog
        isOpen={isRegistrationOpen}
        onClose={() => !connecting && setIsRegistrationOpen(false)}
        title={t("clocks.dialog.registrationTitle")}
        className="max-w-md"
      >
        <ITFlex direction="column" gap={3} className="mt-2">
          <ITFlex direction="column" gap={1}>
            <ITInput
              name="checadorRelojUrl"
              label={t("clocks.dialog.url")}
              placeholder={t("clocks.dialog.urlPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full min-w-0"
            />
            <ITText className="text-[11px] text-slate-500">{t("clocks.dialog.urlHint")}</ITText>
          </ITFlex>
          <ITFlex direction="column" gap={1}>
            <ITInput
              name="checadorRelojNombre"
              label={t("clocks.dialog.name")}
              placeholder={t("clocks.dialog.namePlaceholder")}
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-w-0"
            />
            <ITText className="text-[11px] text-slate-500">{t("clocks.dialog.nameHint")}</ITText>
          </ITFlex>
          <ClockUsage
            fx={fx}
            checked={countsAttendance}
            onChange={setAttendance}
            name="checadorRelojAsistencia"
          />
          <ITText className="text-[11px] text-slate-600">
            {t("clocks.dialog.registrationNote")}
          </ITText>
          {registrationError && <ITAlert variant="error">{registrationError}</ITAlert>}
          <ITFlex justify="end" gap={2}>
            <ITButton
              variant="outlined"
              color="secondary"
              disabled={connecting}
              onClick={() => setIsRegistrationOpen(false)}
            >
              {t("clocks.actions.cancel")}
            </ITButton>
            <ITButton
              variant="filled"
              color="primary"
              disabled={!url.trim() || connecting}
              onClick={() => void register()}
            >
              {connecting ? t("clocks.actions.connecting") : t("clocks.actions.confirmRegistration")}
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>

      <ITDialog
        isOpen={!!editTarget}
        onClose={() => !saving && setEditTarget(null)}
        title={t("clocks.dialog.editTitle", { name: editTarget?.name ?? "" })}
        className="max-w-md"
      >
        <ITFlex direction="column" gap={3} className="mt-2">
          <ITInput
            name="checadorRelojEditarNombre"
            label={t("clocks.dialog.nameEdit")}
            value={editName}
            maxLength={80}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full min-w-0"
          />
          <ClockUsage
            fx={fx}
            checked={editAttendance}
            onChange={setEditAttendance}
            name="checadorRelojEditarAsistencia"
          />
          <ITFlex direction="column" gap={1} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
            <ITCheckbox
              name="checadorRelojEditarEscritura"
              checked={editWrite}
              onChange={setEditWrite}
              label={t("clocks.write.label")}
            />
            <ITText className="text-[11px] text-slate-600">{t("clocks.write.hint")}</ITText>
          </ITFlex>
          <ITText className="text-[11px] text-slate-600">{t("clocks.dialog.editNote")}</ITText>
          {editError && <ITAlert variant="error">{editError}</ITAlert>}
          <ITFlex justify="end" gap={2}>
            <ITButton
              variant="outlined"
              color="secondary"
              disabled={saving}
              onClick={() => setEditTarget(null)}
            >
              {t("clocks.actions.cancel")}
            </ITButton>
            <ITButton
              variant="filled"
              color="primary"
              disabled={!editName.trim() || saving}
              onClick={() => void saveEdit()}
            >
              {t("clocks.actions.save")}
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>

      <ITDialog
        isOpen={!!retirementTarget}
        onClose={() => !retiring && setRetirementTarget(null)}
        title={t("clocks.dialog.retirementTitle", { name: retirementTarget?.name ?? "" })}
        className="max-w-md"
      >
        <ITFlex direction="column" gap={3} className="mt-2">
          <ITText className="text-[12px] text-slate-600">
            {t("clocks.dialog.retirementText")}
          </ITText>
          <ITFlex justify="end" gap={2}>
            <ITButton
              variant="outlined"
              color="secondary"
              disabled={retiring}
              onClick={() => setRetirementTarget(null)}
            >
              {t("clocks.actions.cancel")}
            </ITButton>
            <ITButton
              variant="filled"
              color="danger"
              disabled={retiring}
              onClick={() => void confirmRetirement()}
            >
              {t("clocks.actions.confirmRetirement")}
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>

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

/** Si las checadas del reloj cuentan para entradas/salidas (alta y edición). */
function ClockUsage({
  fx,
  checked,
  onChange,
  name,
}: {
  fx: UseTimeClocks;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name: string;
}) {
  const { t } = fx;
  return (
    <ITFlex direction="column" gap={1}>
      <ITCheckbox name={name} checked={checked} onChange={onChange} label={t("clocks.usage.checkbox")} />
      <ITText className="text-[11px] text-slate-500">{t("clocks.usage.hint")}</ITText>
    </ITFlex>
  );
}

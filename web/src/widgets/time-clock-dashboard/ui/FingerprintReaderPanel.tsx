import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaFingerprint } from "react-icons/fa";
import { ITAlert, ITButton, ITFlex, ITSelect, ITText } from "@axzydev/axzy_ui_system";
import { timeClockApi, type FingerprintStationInfo, type FingerprintStationTest } from "@entities/time-clock";

const FINGERS = Array.from({ length: 10 }, (_, i) => i + 1);

/** Prueba del lector de huellas de la estación: captura un dedo y muestra su calidad. No guarda nada. */
export default function FingerprintReaderPanel() {
  const { t } = useTranslation("time-clock");
  const [info, setInfo] = useState<FingerprintStationInfo | null>(null);
  const [fingerNo, setFingerNo] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FingerprintStationTest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    timeClockApi.fingerprintStationInfo().then(setInfo).catch(() => setInfo({ configured: false, url: null }));
  }, []);

  const test = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await timeClockApi.fingerprintStationTest(fingerNo));
    } catch (e: any) {
      setError(e?.message ?? t("dashboard.reader.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ITFlex direction="column" gap={4} className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
      <ITFlex align="center" gap={2}>
        <FaFingerprint className="text-slate-700" />
        <ITText className="font-semibold text-slate-900">{t("dashboard.reader.title")}</ITText>
      </ITFlex>
      <ITText className="text-sm text-slate-500">{t("dashboard.reader.hint")}</ITText>

      {info && !info.configured && <ITAlert variant="warning">{t("dashboard.reader.notConfigured")}</ITAlert>}
      {info?.configured && info.url && (
        <ITText className="text-xs text-slate-400">{t("dashboard.reader.station", { url: info.url })}</ITText>
      )}

      <ITFlex align="end" gap={3} wrap="wrap">
        <ITSelect
          name="readerFinger"
          label={t("dashboard.reader.finger")}
          options={FINGERS.map((n) => ({ value: String(n), label: String(n) }))}
          value={String(fingerNo)}
          onChange={(e) => setFingerNo(Number(e.target.value))}
        />
        <ITButton variant="raised-text" color="primary" disabled={busy || !info?.configured} onClick={test}>
          {busy ? t("dashboard.reader.testing") : t("dashboard.reader.test")}
        </ITButton>
      </ITFlex>

      {error && <ITAlert variant="error">{error}</ITAlert>}

      {result && (
        <ITFlex direction="column" gap={2}>
          <ITText className="text-sm text-slate-600">
            {t("dashboard.reader.quality")}:{" "}
            <strong className={result.acceptable ? "text-emerald-700" : "text-amber-700"}>{result.quality}</strong> / 100 (
            {t("dashboard.reader.min", { min: result.minQuality })})
          </ITText>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full ${result.acceptable ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${Math.min(100, result.quality)}%` }}
            />
          </div>
          <ITText className="text-sm">
            {result.acceptable ? t("dashboard.reader.acceptable") : t("dashboard.reader.low")}
          </ITText>
        </ITFlex>
      )}
    </ITFlex>
  );
}

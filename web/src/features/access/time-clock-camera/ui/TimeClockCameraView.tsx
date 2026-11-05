import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { timeClockApi, type TimeClockCamera } from "@entities/time-clock";
import { ITText, ITStack } from "@axzydev/axzy_ui_system";

/** Cámara de la terminal: reproduce el video si el navegador puede; si es RTSP, informa la ruta sin credenciales. */
export default function TimeClockCameraView({ clockSerial }: { clockSerial: string }) {
  const { t } = useTranslation("time-clock");
  const [camera, setCamera] = useState<TimeClockCamera | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clockSerial) return;
    setError(null);
    timeClockApi
      .inspectCamera(clockSerial)
      .then(setCamera)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t("camera.errors.read")));
  }, [clockSerial, t]);

  if (error) return <ITText role="alert" className="text-sm text-red-600">{error}</ITText>;
  if (!camera) return <ITText className="text-sm text-slate-400">{t("camera.loading")}</ITText>;

  return (
    <ITStack spacing={4}>
      {camera.playback.mode === "http" ? (
        <video
          key={camera.playback.url}
          controls
          muted
          className="w-full max-w-2xl rounded-xl border border-slate-200 bg-black"
          src={camera.playback.url}
        >
          {t("camera.noBrowser")}
        </video>
      ) : (
        <div className="max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <ITText className="font-semibold">{t("camera.rtsp.title")}</ITText>
          <ITText className="mt-1">{t("camera.rtsp.body")}</ITText>
          {camera.playback.rtspPath && (
            <ITText className="mt-2 font-mono text-xs text-amber-900">{camera.playback.rtspPath}</ITText>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-[var(--it-card-bg)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">{t("camera.table.stream")}</th>
              <th className="px-4 py-2">{t("camera.table.name")}</th>
              <th className="px-4 py-2">{t("camera.table.transport")}</th>
              <th className="px-4 py-2">{t("camera.table.resolution")}</th>
              <th className="px-4 py-2">{t("camera.table.enabled")}</th>
            </tr>
          </thead>
          <tbody>
            {camera.streams.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono">{s.id}</td>
                <td className="px-4 py-2">{s.name ?? "—"}</td>
                <td className="px-4 py-2">{s.transport ?? "—"}</td>
                <td className="px-4 py-2">{s.width && s.height ? `${s.width}×${s.height}` : "—"}</td>
                <td className="px-4 py-2">{s.enabled ? t("camera.yes") : t("camera.no")}</td>
              </tr>
            ))}
            {camera.streams.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400">{t("camera.noStreams")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ITStack>
  );
}

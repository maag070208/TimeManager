import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { timeClockApi, type TimeClockCamera } from "@entities/time-clock";
import { ITDataTable, ITText, ITStack } from "@axzydev/axzy_ui_system";
import type { Column } from "@axzydev/axzy_ui_system";
import { makeClientTableFetch } from "@shared/api/clientTable";

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

  const fetchData = useMemo(
    () => makeClientTableFetch(() => Promise.resolve(camera?.streams ?? [])),
    [camera]
  );

  const columns: Column<TimeClockCamera["streams"][number]>[] = [
    {
      key: "id",
      label: t("camera.table.stream"),
      type: "string",
      width: 110,
      render: (stream) => <ITText className="font-mono text-[12px] text-slate-700">{stream.id}</ITText>,
    },
    {
      key: "name",
      label: t("camera.table.name"),
      type: "string",
      filter: true,
      render: (stream) => <ITText className="text-[12px] text-slate-700">{stream.name ?? "—"}</ITText>,
    },
    {
      key: "transport",
      label: t("camera.table.transport"),
      type: "string",
      width: 130,
      render: (stream) => <ITText className="text-[12px] text-slate-700">{stream.transport ?? "—"}</ITText>,
    },
    {
      key: "resolution",
      label: t("camera.table.resolution"),
      type: "string",
      width: 150,
      render: (stream) => (
        <ITText className="text-[12px] tabular-nums text-slate-700">
          {stream.width && stream.height ? `${stream.width}×${stream.height}` : "—"}
        </ITText>
      ),
    },
    {
      key: "enabled",
      label: t("camera.table.enabled"),
      type: "string",
      width: 120,
      render: (stream) => (
        <ITText className="text-[12px] font-semibold text-slate-700">
          {stream.enabled ? t("camera.yes") : t("camera.no")}
        </ITText>
      ),
    },
  ];

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

      <ITDataTable showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        fetchData={fetchData as never}
      />
      {camera.streams.length === 0 && (
        <ITText className="text-center text-sm text-slate-400">{t("camera.noStreams")}</ITText>
      )}
    </ITStack>
  );
}

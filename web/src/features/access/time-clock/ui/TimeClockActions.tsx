import { ITButton, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaCloudDownloadAlt, FaCog, FaFileCsv, FaSyncAlt } from "react-icons/fa";
import type { UseTimeClock } from "../model/useTimeClock";

interface Props {
  fx: UseTimeClock;
  /** Solo para quien puede administrar los relojes (ADMIN). */
  onManageClocks?: () => void;
}

/**
 * Acciones de la pantalla, en el encabezado de la página: administrar los
 * relojes, importar un rango de fechas, el CSV y la sincronización.
 */
export default function TimeClockActions({ fx, onManageClocks }: Props) {
  const {
    t,
    status,
    dateRange,
    inProgress,
    importing,
    starting,
    exporting,
    handleSyncAll,
    handleImportRange,
    handleExportCsv,
  } = fx;

  const sinRelojes = !status?.configured || status.devices.length === 0;

  return (
    <ITFlex align="center" wrap="wrap" gap={2}>
      {onManageClocks && (
        <ITButton variant="outlined" color="secondary" size="sm" onClick={onManageClocks}>
          <ITFlex align="center" gap={1}>
            <FaCog size={11} />
            <ITText className="font-bold text-[11px]">{t("status.manage")}</ITText>
          </ITFlex>
        </ITButton>
      )}
      <ITText as="span" title={t("import.hint")}>
        <ITButton
          variant="outlined"
          color="primary"
          size="sm"
          onClick={handleImportRange}
          disabled={importing || starting || !dateRange[0] || !status?.configured}
        >
          <ITFlex align="center" gap={1}>
            <FaCloudDownloadAlt size={13} />
            <ITText className="font-bold text-[11px]">
              {importing ? t("import.running") : t("import.button")}
            </ITText>
          </ITFlex>
        </ITButton>
      </ITText>
      <ITButton
        variant="outlined"
        color="gray"
        size="sm"
        onClick={() => void handleExportCsv()}
        disabled={exporting}
      >
        <ITFlex align="center" gap={1}>
          <FaFileCsv className="text-emerald-600" size={13} />
          <ITText className="font-bold text-[11px]">
            {exporting ? t("actions.exporting") : t("actions.exportCsv")}
          </ITText>
        </ITFlex>
      </ITButton>
      <ITText as="span" title={t("sync.hint")}>
        <ITButton
          variant="filled"
          color="primary"
          size="sm"
          disabled={inProgress || importing || starting || sinRelojes}
          onClick={() => void handleSyncAll()}
        >
          <ITFlex align="center" gap={1}>
            <FaSyncAlt size={11} className={inProgress || importing ? "animate-spin" : undefined} />
            <ITText className="font-bold text-[11px]">{t("sync.button")}</ITText>
          </ITFlex>
        </ITButton>
      </ITText>
    </ITFlex>
  );
}

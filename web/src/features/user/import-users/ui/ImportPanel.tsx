import { ITButton, ITCard, ITText } from "@axzydev/axzy_ui_system";
import { FaDownload, FaFileExcel, FaUpload } from "react-icons/fa";
import { LuUpload } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { HelpTip } from "@shared/ui/help-tip";
import type { UseUserImport } from "../model/useUserImport";

interface Props {
  fx: UseUserImport;
}

export default function ImportPanel({ fx }: Props) {
  const { t: tt } = useTranslation("users");

  return (
    <ITCard contentClassName="!p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><FaFileExcel size={14} /></span>
          <ITText className="font-bold">Archivo de Excel</ITText>
          <HelpTip text={tt("import.help")} />
        </div>
        <ITButton variant="text" color="primary" size="sm" disabled={fx.downloadingTemplate} onClick={() => void fx.handleDownloadTemplate()}>
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold"><FaDownload size={11} /> {fx.downloadingTemplate ? tt("import.downloading") : tt("import.download")}</span>
        </ITButton>
      </div>

      <input
        ref={fx.inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => fx.setFile(e.target.files?.[0] ?? null)}
      />

      <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm"><LuUpload size={18} /></span>
        <ITText className="!text-[13px] font-semibold text-slate-700">{fx.file ? fx.file.name : tt("import.noFile")}</ITText>
        <ITText className="!text-[11.5px] text-slate-500">Archivo .xlsx o .xls</ITText>
        <ITButton variant="outlined" color="primary" size="sm" className="tm-row-button mt-1" onClick={() => fx.inputRef.current?.click()}>
          {tt("import.browse")}
        </ITButton>
      </div>

      <div className="mt-3 flex justify-end">
        <ITButton variant="filled" color="primary" size="sm" className="tm-row-button" onClick={fx.handleImport} disabled={!fx.file || fx.uploading}>
          <span className="inline-flex items-center gap-1"><FaUpload size={11} /> {fx.uploading ? tt("import.importing") : tt("import.importBtn")}</span>
        </ITButton>
      </div>
    </ITCard>
  );
}

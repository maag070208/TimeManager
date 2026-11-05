import { ITButton, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaFileExcel, FaUpload } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { UseUserImport } from "../model/useUserImport";

interface Props {
  fx: UseUserImport;
}

export default function ImportPanel({ fx }: Props) {
  const { t: tt } = useTranslation("users");

  return (
    <ITCard className="p-6 mb-6">
      <ITFlex direction="column" gap={4}>
        <div>
          <input
            ref={fx.inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => fx.setFile(e.target.files?.[0] ?? null)}
          />
          <ITFlex align="center" gap={3}>
            <ITButton
              variant="outlined"
              color="secondary"
              onClick={() => fx.inputRef.current?.click()}
            >
              <ITFlex align="center" gap={1}>
                <FaFileExcel size={12} />
                <ITText className="text-[11px] font-bold">{tt("import.browse")}</ITText>
              </ITFlex>
            </ITButton>
            <ITText className="text-[11px] font-bold text-slate-500">
              {fx.file ? fx.file.name : tt("import.noFile")}
            </ITText>
          </ITFlex>
        </div>

        <ITFlex justify="end">
          <ITButton
            variant="filled"
            color="primary"
            onClick={fx.handleImport}
            disabled={!fx.file || fx.uploading}
          >
            <ITFlex align="center" gap={1}>
              <FaUpload size={12} />
              <ITText className="text-[11px] font-bold">
                {fx.uploading ? tt("import.importing") : tt("import.importBtn")}
              </ITText>
            </ITFlex>
          </ITButton>
        </ITFlex>
      </ITFlex>
    </ITCard>
  );
}
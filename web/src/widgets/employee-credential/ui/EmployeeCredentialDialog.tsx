import { LottieLoader } from "@shared/ui/lottie-loader";
import { ITAlert, ITButton, ITDialog, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaDownload } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { PersonalProfile } from "@entities/hr";
import { useEmployeeCredential } from "../model/useEmployeeCredential";
import { downloadCredentialImage } from "../model/image";
import EmployeeCredentialPreview from "./EmployeeCredentialPreview";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: PersonalProfile | null;
}

/** Diálogo con la previsualización de la credencial y la descarga de la imagen. */
export default function EmployeeCredentialDialog({ isOpen, onClose, profile }: Props) {
  const { t: tt } = useTranslation(["employees"]);
  const { imageDataUrl, loading, error } = useEmployeeCredential(profile);

  const download = () => {
    if (!profile || !imageDataUrl) return;
    void downloadCredentialImage({ profile, imageDataUrl });
  };

  return (
    <ITDialog
      isOpen={isOpen}
      onClose={onClose}
      title={tt("employees:detail.credentialTitle")}
      className="max-w-3xl"
    >
      <div className="max-h-[75vh] overflow-y-auto">
        {loading ? (
          <ITFlex justify="center" className="py-12">
            <LottieLoader size="lg" />
          </ITFlex>
        ) : error ? (
          <ITAlert variant="error">{error}</ITAlert>
        ) : profile && imageDataUrl ? (
          <ITFlex direction="column" gap={4}>
            <EmployeeCredentialPreview imageDataUrl={imageDataUrl} />
            <ITFlex justify="end" gap={2}>
              <ITButton
                variant="filled"
                color="primary"
                onClick={download}
                disabled={loading || !imageDataUrl}
              >
                <ITFlex align="center" gap={1}>
                  <FaDownload size={13} />
                  <ITText className="font-bold text-[11px]">{tt("employees:detail.download")}</ITText>
                </ITFlex>
              </ITButton>
            </ITFlex>
          </ITFlex>
        ) : null}
      </div>
    </ITDialog>
  );
}

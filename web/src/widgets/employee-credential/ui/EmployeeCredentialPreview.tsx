import { useTranslation } from "react-i18next";

/** Vista previa de la credencial ya renderizada como PNG. */
export default function EmployeeCredentialPreview({
  imageDataUrl,
}: {
  imageDataUrl: string | null;
}) {
  const { t: tt } = useTranslation(["employees"]);
  if (!imageDataUrl) return null;

  return (
    <img
      src={imageDataUrl}
      alt={tt("employees:detail.credentialTitle")}
      className="w-full max-w-3xl h-auto rounded-2xl border border-slate-200"
      style={{ aspectRatio: "1016 / 638" }}
    />
  );
}

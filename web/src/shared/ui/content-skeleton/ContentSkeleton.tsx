import { ITSkeleton, ITStack } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";

interface Props {
  /** `md`: el mismo esqueleto de `ITPage loading`; `sm`: para paneles y diálogos. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Único indicador de carga de contenido de la app: el esqueleto de `ITPage`.
 * Si carga la página completa, usar `<ITPage loading>`; este componente es
 * para un bloque que carga dentro de una página o de un diálogo.
 */
export default function ContentSkeleton({ size = "md", className }: Props) {
  const { t } = useTranslation("common");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className={className}>
      {size === "sm" ? (
        <ITStack spacing={3}>
          <ITSkeleton variant="rectangular" height={24} width="40%" className="rounded-lg" />
          <ITSkeleton variant="rectangular" height={96} className="rounded-lg" />
        </ITStack>
      ) : (
        <ITStack spacing={6}>
          <ITSkeleton variant="rectangular" height={40} width="40%" className="rounded-lg" />
          <ITSkeleton variant="rectangular" height={200} className="rounded-lg" />
          <ITSkeleton variant="rectangular" height={200} className="rounded-lg" />
        </ITStack>
      )}
    </div>
  );
}

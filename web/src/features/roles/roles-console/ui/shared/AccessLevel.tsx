import { useTranslation } from "react-i18next";
import type { AccessLevel } from "../../model/access-levels";
import { LEVEL_STYLE } from "./tokens";
import { ITText } from "@axzydev/axzy_ui_system";

/** "Completo · Parcial · Solo lectura · Sin acceso" con su punto de color. */
export function AccessLevelBadge({ level }: { level: AccessLevel }) {
  const { t } = useTranslation("roles");
  const style = LEVEL_STYLE[level];
  return (
    <ITText as="span" className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${style.text}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {t(`level.${level}`)}
    </ITText>
  );
}

/** Barra de cobertura (concedidos / total). */
export function CoverageBar({
  granted,
  total,
  level,
  className = "w-20",
}: {
  granted: number;
  total: number;
  level: AccessLevel;
  className?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((granted / total) * 100);
  return (
    <ITText as="span" className={`inline-flex items-center gap-2 ${className}`}>
      <ITText as="span" className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span
          className={`block h-full rounded-full transition-all ${LEVEL_STYLE[level].bar}`}
          style={{ width: `${percent}%` }}
        />
      </ITText>
      <ITText as="span" className="text-[10px] font-bold tabular-nums text-slate-400">
        {granted}/{total}
      </ITText>
    </ITText>
  );
}

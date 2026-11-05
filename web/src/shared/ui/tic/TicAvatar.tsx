import { useTranslation } from "react-i18next";
import { LangostinAnim } from "./langostinSprite";
import Langostin from "./Langostin";
import { ITText } from "@axzydev/axzy_ui_system";

interface Props {
  anim: LangostinAnim;
  size?: number;
  animated?: boolean;
}

/** Avatar de Langostin al lado de los mensajes y del bloque de opciones. */
export default function LangostinAvatar({ anim, size = 28, animated = true }: Props) {
  const { t } = useTranslation("tickets");
  // La caja crece con el sprite: si no, un avatar grande se sale del círculo.
  const box = size + 12;
  return (
    <ITText as="span"
      className="flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
      style={{ width: box, height: box }}
    >
      <Langostin anim={anim} size={size} animated={animated} label={t("new.agent.mascot")} />
    </ITText>
  );
}

import { useTranslation } from "react-i18next";
import { TicAnim } from "./ticSprite";
import Tic from "./Tic";
import { ITText } from "@axzydev/axzy_ui_system";

interface Props {
  anim: TicAnim;
  size?: number;
  animated?: boolean;
}

/** Avatar de Tic al lado de los mensajes y del bloque de opciones. */
export default function TicAvatar({ anim, size = 28, animated = true }: Props) {
  const { t } = useTranslation("tic");
  // La caja crece con el sprite: si no, un avatar grande se sale del círculo.
  const box = size + 12;
  return (
    <ITText as="span"
      className="flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
      style={{ width: box, height: box }}
    >
      <Tic anim={anim} size={size} animated={animated} label={t("avatar.label")} />
    </ITText>
  );
}

import { useITAppearance, ITText } from "@axzydev/axzy_ui_system";

interface Props {
  label: string;
  /** Emoji a color de la pastilla. */
  emoji?: string;
  delay?: number;
  onClick: () => void;
}

// Opción tocable del chat con emoji a color. En bento es una píldora de control
// (gris, sin borde; tinta al tocarla); en flat/soft, una pastilla neutra con
// borde. Todo con tokens del kit. Se eleva al pasar el cursor y se encoge al tocarla.
export default function OptionChip({ emoji, label, delay = 0, onClick }: Props) {
  const bento = useITAppearance() === "bento";
  const look = bento
    ? "border border-transparent bg-[color:var(--it-bento-control-bg)] text-[color:var(--it-bento-control-text)] hover:bg-[color:var(--it-bento-control-bg-hover)] active:bg-[color:var(--it-bento-ink-bg)] active:text-[color:var(--it-bento-ink-text)]"
    : "border border-[color:var(--it-card-border,#e2e8f0)] bg-[color:var(--it-card-bg,#ffffff)] text-[color:var(--color-text-default)] shadow-sm hover:border-[color:var(--color-primary)] hover:shadow-md";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`agent-pop inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition duration-200 hover:-translate-y-0.5 active:scale-95 ${look}`}
    >
      {emoji && (
        <ITText as="span" aria-hidden className="text-sm leading-none">
          {emoji}
        </ITText>
      )}
      {label}
    </button>
  );
}

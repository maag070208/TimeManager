import { useState } from "react";
import { ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

export interface CollapsibleCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  mb?: number;
}

/**
 * Card con encabezado clicable que colapsa/expande su contenido.
 * El kit no expone un collapse genérico, por eso este wrapper compartido.
 * Se pinta sobre `ITCard`: fondo, borde, radio y sombra salen de la apariencia.
 */
export default function CollapsibleCard({
  icon,
  iconBg,
  title,
  right,
  defaultOpen = true,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <ITCard className="w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "w-full text-left" +
          (open ? " mb-4" : "")
        }
      >
        <ITFlex align="center" justify="between" gap={2}>
          <ITFlex align="center" gap={2}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${iconBg}`}>
              {icon}
            </div>
            <ITText className="text-[12px] font-black uppercase tracking-widest text-slate-700">{title}</ITText>
          </ITFlex>
          <ITFlex align="center" gap={2}>
            {right}
            <ITText as="span" className="shrink-0 text-slate-400">
              {open ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
            </ITText>
          </ITFlex>
        </ITFlex>
      </button>

      {open && <div className="mt-5">{children}</div>}
    </ITCard>
  );
}

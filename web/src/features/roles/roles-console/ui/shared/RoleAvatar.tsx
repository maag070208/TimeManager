import type { ReactNode } from "react";
import { FaIdBadge, FaUser, FaUserCog, FaUsers, FaUserShield, FaUserTie, FaUtensils } from "react-icons/fa";
import { roleLabel } from "@entities/user";
import { ROLE_TONES, roleTone } from "./tokens";
import { ITText } from "@axzydev/axzy_ui_system";

/** Íconos de los roles base; los creados en `/roles` muestran sus iniciales. */
const BASE_ICONS: Record<string, (size: number) => ReactNode> = {
  ADMIN: (s) => <FaUserShield size={s} />,
  MANAGER: (s) => <FaUserTie size={s} />,
  AREA_HEAD: (s) => <FaUserCog size={s} />,
  EMPLOYEE: (s) => <FaUser size={s} />,
  HUMAN_RESOURCES: (s) => <FaUsers size={s} />,
  CHEF: (s) => <FaUtensils size={s} />,
  GUARD: (s) => <FaIdBadge size={s} />,
};

/** Iniciales de un rol creado a mano (INVENTARIO → IN, AUX_ALMACEN → AA). */
const initialsOf = (role: string): string => {
  const parts = role.split("_").filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : role.slice(0, 2)).toUpperCase();
};

const SIZES = {
  sm: { box: "h-7 w-7 rounded-lg text-[10px]", icon: 12 },
  md: { box: "h-9 w-9 rounded-xl text-[11px]", icon: 15 },
  lg: { box: "h-14 w-14 rounded-2xl text-[16px]", icon: 24 },
} as const;

interface Props {
  role: string;
  size?: keyof typeof SIZES;
}

export default function RoleAvatar({ role, size = "md" }: Props) {
  const icon = BASE_ICONS[role];
  const tone = ROLE_TONES[roleTone(role)];
  const spec = SIZES[size];
  return (
    <ITText as="span"
      className={`flex shrink-0 items-center justify-center font-black ${spec.box} ${tone.soft}`}
      title={roleLabel(role)}
      aria-hidden
    >
      {icon ? icon(spec.icon) : initialsOf(role)}
    </ITText>
  );
}

interface ChipProps {
  role: string;
  /** Texto pequeño al lado del nombre (p. ej. "principal"). */
  suffix?: string;
  muted?: boolean;
  onClick?: () => void;
}

/** Píldora con el color del rol. */
export function RoleChip({ role, suffix, muted = false, onClick }: ChipProps) {
  const tone = ROLE_TONES[roleTone(role)];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 !bg-[var(--it-card-bg)] px-2.5 py-0.5 text-[11px] font-bold ${
        muted ? "text-slate-400 line-through" : "text-slate-700"
      } ${onClick ? "cursor-pointer hover:border-slate-300 hover:shadow-sm" : ""}`}
    >
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
      {roleLabel(role)}
      {suffix && <ITText as="span" className="font-semibold text-slate-400">· {suffix}</ITText>}
    </Tag>
  );
}

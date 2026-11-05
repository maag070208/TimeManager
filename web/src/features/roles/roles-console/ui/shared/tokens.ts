import type { PermissionScope } from "@entities/user";
import type { AccessLevel } from "../../model/access-levels";

/** Estilos compartidos de la consola de roles (tonos de rol, alcance y nivel). */

export type RoleTone = "indigo" | "sky" | "amber" | "slate" | "emerald" | "rose" | "violet" | "teal" | "fuchsia";

/** Clases por tono: fondo suave + texto, y el punto sólido para chips y columnas. */
export const ROLE_TONES: Record<RoleTone, { soft: string; dot: string; ring: string }> = {
  indigo: { soft: "bg-indigo-50 text-indigo-600", dot: "bg-indigo-500", ring: "ring-indigo-200" },
  sky: { soft: "bg-sky-50 text-sky-600", dot: "bg-sky-500", ring: "ring-sky-200" },
  amber: { soft: "bg-amber-50 text-amber-600", dot: "bg-amber-500", ring: "ring-amber-200" },
  slate: { soft: "bg-slate-100 text-slate-600", dot: "bg-slate-500", ring: "ring-slate-200" },
  emerald: { soft: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  rose: { soft: "bg-rose-50 text-rose-600", dot: "bg-rose-500", ring: "ring-rose-200" },
  violet: { soft: "bg-violet-50 text-violet-600", dot: "bg-violet-500", ring: "ring-violet-200" },
  teal: { soft: "bg-teal-50 text-teal-600", dot: "bg-teal-500", ring: "ring-teal-200" },
  fuchsia: { soft: "bg-fuchsia-50 text-fuchsia-600", dot: "bg-fuchsia-500", ring: "ring-fuchsia-200" },
};

/** El mismo tono como variable CSS: para las barras y leyendas del kit. */
export const ROLE_VARS: Record<RoleTone, string> = {
  indigo: "var(--color-indigo-500)",
  sky: "var(--color-sky-500)",
  amber: "var(--color-amber-500)",
  slate: "var(--color-slate-500)",
  emerald: "var(--color-emerald-500)",
  rose: "var(--color-rose-500)",
  violet: "var(--color-violet-500)",
  teal: "var(--color-teal-500)",
  fuchsia: "var(--color-fuchsia-500)",
};

/** Tonos fijos de los roles base; los creados en `/roles` toman uno estable por su clave. */
const BASE_TONES: Record<string, RoleTone> = {
  ADMIN: "indigo",
  MANAGER: "sky",
  AREA_HEAD: "amber",
  EMPLOYEE: "slate",
  HUMAN_RESOURCES: "emerald",
  CHEF: "fuchsia",
  GUARD: "rose",
};

const CUSTOM_TONES: readonly RoleTone[] = ["violet", "teal", "sky", "amber", "emerald", "rose", "fuchsia", "indigo"];

export const roleTone = (role: string): RoleTone => {
  const base = BASE_TONES[role];
  if (base) return base;
  let hash = 0;
  for (const char of role) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CUSTOM_TONES[hash % CUSTOM_TONES.length];
};

export const SCOPE_STYLE: Record<PermissionScope, string> = {
  NONE: "border-slate-200 text-slate-400",
  OWN: "border-sky-200 bg-sky-50 text-sky-700",
  AREA: "border-violet-200 bg-violet-50 text-violet-700",
  ALL: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

/** Letra de la celda de la matriz: ✓ para sí/no; P/A/T para permisos con alcance. */
export const scopeGlyph = (scope: PermissionScope, scoped: boolean): string => {
  if (scope === "NONE") return "·";
  if (!scoped) return "✓";
  return { OWN: "P", AREA: "A", ALL: "T" }[scope];
};

export const scopeCellClass = (scope: PermissionScope): string =>
  ({
    NONE: "!bg-[var(--it-card-bg)] text-slate-300 hover:!bg-slate-50",
    OWN: "!bg-sky-100 text-sky-700 hover:!bg-sky-200",
    AREA: "!bg-violet-100 text-violet-700 hover:!bg-violet-200",
    ALL: "!bg-emerald-100 text-emerald-700 hover:!bg-emerald-200",
  })[scope];

export const LEVEL_STYLE: Record<AccessLevel, { dot: string; text: string; bar: string }> = {
  FULL: { dot: "bg-emerald-500", text: "text-emerald-700", bar: "bg-emerald-500" },
  PARTIAL: { dot: "bg-amber-500", text: "text-amber-700", bar: "bg-amber-500" },
  READ: { dot: "bg-sky-500", text: "text-sky-700", bar: "bg-sky-500" },
  NONE: { dot: "bg-slate-300", text: "text-slate-400", bar: "bg-slate-300" },
};

export const levelBarClass = (level: AccessLevel): string => LEVEL_STYLE[level].bar;

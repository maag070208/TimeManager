// Primitivas de UI compartidas entre el tablero Kanban (KanbanPage) y el
// modal de detalle de ticket (TicketDetailModal): tipos de estado, mapas de
// etiqueta/color, y los componentes Tag/Avatar. Viven aparte para que
// ambos las importen desde un solo lugar en vez de duplicarlas.

import { ProfileAvatar } from "../profile-avatar";
import { ITText } from "@axzydev/axzy_ui_system";

export type Status = "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";

export interface Tone {
  bg: string;
  text: string;
}

// Los colores se aplican con `style` inline, NO con clases de Tailwind: las
// clases de color armadas dinámicamente no compilaban. Los estados usan
// tokens del tema (`var(--color-*)`); solo el gris neutro y la paleta
// determinista de etiquetas/avatares (sin significado de marca) siguen en hex.
export const FALLBACK_TONE: Tone = { bg: "#94a3b8", text: "#ffffff" };

export const PRIORITY_META: Record<string, { tone: Tone }> = {
  LOW: { tone: { bg: "#94a3b8", text: "#ffffff" } },
  MEDIUM: { tone: { bg: "var(--color-warning)", text: "#ffffff" } },
  HIGH: { tone: { bg: "var(--color-alert)", text: "#ffffff" } },
  URGENT: { tone: { bg: "var(--color-danger)", text: "#ffffff" } },
};

export const STATUS_META: Record<string, { tone: Tone }> = {
  OPEN: { tone: { bg: "var(--color-warning)", text: "#ffffff" } },
  IN_PROGRESS: { tone: { bg: "var(--color-secondary)", text: "#ffffff" } },
  CLOSED: { tone: { bg: "var(--color-success)", text: "#ffffff" } },
};

export const ASSIGNMENT_STATUS_META: Record<Status, { tone: Tone }> = {
  PENDING: { tone: { bg: "#94a3b8", text: "#ffffff" } },
  IN_PROGRESS: { tone: { bg: "var(--color-secondary)", text: "#ffffff" } },
  IN_REVIEW: { tone: { bg: "var(--color-info)", text: "#ffffff" } },
  COMPLETED: { tone: { bg: "var(--color-success)", text: "#ffffff" } },
};

// Paleta determinista para etiquetas de departamento y avatares: mismo
// nombre siempre obtiene el mismo color, sin tener que mantener un mapa
// manual por departamento.
//
// Acotada a tonos que combinan con el azul/marino del resto del panel
// (sidebar, botones primarios). Se quitaron los rosas/fucsias neón que
// desentonaban con el resto de la interfaz.
const TAG_PALETTE: Tone[] = [
  { bg: "#3b82f6", text: "#ffffff" }, // blue
  { bg: "#6366f1", text: "#ffffff" }, // indigo
  { bg: "#0d9488", text: "#ffffff" }, // teal
  { bg: "#0891b2", text: "#ffffff" }, // cyan
  { bg: "#059669", text: "#ffffff" }, // emerald
  { bg: "#f59e0b", text: "#ffffff" }, // amber
  { bg: "#ea580c", text: "#ffffff" }, // orange
  { bg: "#8b5cf6", text: "#ffffff" }, // violet
  { bg: "#0284c7", text: "#ffffff" }, // sky
  { bg: "#65a30d", text: "#ffffff" }, // lime-green
];

export function hashTone(key: string): Tone {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

export function metaFor(map: Record<string, { tone: Tone }>, key: string) {
  return map[key] ?? { tone: FALLBACK_TONE };
}

export function Tag({ label, tone, icon }: { label: string; tone: Tone; icon?: React.ReactNode }) {
  return (
    <ITText as="span"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: tone.bg, color: tone.text }}
    >
      {icon}
      {label}
    </ITText>
  );
}

// Clases completas y estáticas por tamaño: Tailwind solo genera utilidades
// que aparecen literalmente en el código, así que un `w-${size}` armado en
// tiempo de ejecución nunca compila a nada. El `!` pisa el tamaño base de
// `ProfileAvatar`.
const AVATAR_SIZE_CLASSES: Record<number, string> = {
  6: "w-6! h-6!",
  7: "w-7! h-7!",
  8: "w-8! h-8!",
};

/** Avatar de una persona: Blobatar determinista a partir de su nombre (sin foto en el tablero). */
export function Avatar({ name, size = 7 }: { name: string; size?: 6 | 7 | 8 }) {
  const sizeClass = AVATAR_SIZE_CLASSES[size] ?? AVATAR_SIZE_CLASSES[7];
  return (
    <ITText as="span" title={name} className="inline-flex shrink-0">
      <ProfileAvatar name={name} size="sm" className={`${sizeClass} border-2 border-white shadow-sm`} />
    </ITText>
  );
}

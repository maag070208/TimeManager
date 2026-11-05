import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { LuBuilding2, LuBriefcase, LuCamera, LuCalendarClock, LuFolderCheck } from "react-icons/lu";
import {
  ITBadget,
  ITBentoGrid,
  ITBentoTile,
  ITCard,
  ITFlex,
  ITText,
  useITBentoCountUp,
} from "@axzydev/axzy_ui_system";
import type { PersonalProfile } from "@entities/hr";
import { roleLabel } from "@entities/user";
import { ProfileAvatar } from "@shared/ui/profile-avatar";

const ROLE_COLOR: Record<string, string> = { MANAGER: "purple", AREA_HEAD: "info", EMPLOYEE: "gray" };

/** Fechas guardadas como "YYYY-MM-DD": formatear sin pasar por Date/huso horario. */
const formatDateOnly = (iso?: string | null): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Meses completos entre la fecha de ingreso ("YYYY-MM-DD") y hoy; null si no hay fecha válida. */
const monthsSince = (iso?: string | null): number | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months -= 1;
  return Math.max(0, months);
};

interface Props {
  profile: PersonalProfile;
  onPhotoUpload: (file: File) => Promise<void>;
  /** Tipos de documento con al menos un archivo y total de tipos (del expediente). */
  documents: { done: number; total: number };
}

/**
 * Encabezado de la ficha: la identidad en una tarjeta densa (foto/Blobatar,
 * nombre, puesto y estado en una sola franja) y debajo la tira del mosaico
 * —antigüedad y expediente— con la misma altura que los indicadores de
 * actividad, para que toda la parte de arriba se lea como un solo bloque.
 */
export default function EmployeeHero({ profile, onPhotoUpload, documents }: Props) {
  const { t: tt } = useTranslation(["employees", "common"]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const months = monthsSince(profile.hireDate);
  const years = months === null ? 0 : Math.floor(months / 12);
  const restMonths = months === null ? 0 : months % 12;
  const tenureShown = useITBentoCountUp(years);
  const docsShown = useITBentoCountUp(documents.done);
  const docsLeft = Math.max(0, documents.total - documents.done);

  // Solo se muestran los datos que existen: una fila de guiones no aporta nada.
  const facts = [
    { label: tt("detail.fields.hireDate"), value: profile.hireDate ? formatDateOnly(profile.hireDate) : null },
    { label: tt("detail.fields.subarea"), value: profile.subarea?.name },
    { label: tt("detail.fields.company"), value: profile.company },
  ].filter((f) => f.value?.trim());

  return (
    <ITFlex direction="column" gap={3}>
      {/* Identidad: una tarjeta baja, no un mosaico de tres filas */}
      <ITCard contentClassName="!p-0">
        <ITFlex align="center" gap={4} wrap="wrap" className="px-5 py-4">
          <div className="relative w-fit shrink-0">
            <ProfileAvatar photoUrl={profile.photoUrl} name={profile.name} size="lg" className="h-[64px]! w-[64px]!" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={tt("detail.changePhoto")}
              aria-label={tt("detail.changePhoto")}
              style={{ backgroundColor: "var(--it-bento-ink-bg, var(--color-primary))", color: "var(--it-bento-ink-text, white)" }}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full !border-0 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
            >
              <LuCamera size={12} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPhotoUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          <ITFlex direction="column" gap={1} className="min-w-0 flex-1">
            <ITText as="h2" className="m-0 line-clamp-1 !text-[21px] font-extrabold leading-tight">
              {profile.name}
            </ITText>
            <ITText muted className="m-0 flex flex-wrap items-center gap-x-2 !text-[12.5px]">
              <ITText as="span" className="inline-flex items-center gap-1.5">
                <LuBriefcase size={13} />
                {profile.jobTitle?.trim() || "—"}
              </ITText>
              <ITText as="span" aria-hidden>
                ·
              </ITText>
              <ITText as="span" className="inline-flex items-center gap-1.5">
                <LuBuilding2 size={13} />
                {profile.department?.name ?? "—"}
              </ITText>
            </ITText>
          </ITFlex>

          <ITFlex align="center" wrap="wrap" gap={1.5} className="shrink-0">
            <ITBadget color={(ROLE_COLOR[profile.role] as any) ?? "gray"} size="md">
              {roleLabel(profile.role)}
            </ITBadget>
            <ITBadget color={profile.active ? "success" : "danger"} size="md">
              {profile.active ? tt("detail.active") : tt("detail.inactive")}
            </ITBadget>
            {profile.employeeNumber && (
              <ITText as="span" className="rounded-full bg-[color-mix(in_srgb,currentColor_8%,transparent)] px-2.5 py-1 font-mono !text-[11.5px] font-semibold">
                #{profile.employeeNumber}
              </ITText>
            )}
          </ITFlex>

          {facts.length > 0 && (
            <ITFlex align="center" wrap="wrap" gap={4} className="w-full   pt-3">
              {facts.map((f) => (
                <ITFlex key={f.label} direction="column" gap={0} className="min-w-0">
                  <ITText muted className="!text-[11px]">
                    {f.label}
                  </ITText>
                  <ITText className="truncate !text-[12.5px] font-semibold">{f.value}</ITText>
                </ITFlex>
              ))}
            </ITFlex>
          )}
        </ITFlex>
      </ITCard>

      {/* Tira del mosaico: antigüedad y expediente, misma altura que los KPIs */}
      <ITBentoGrid>
        <ITBentoTile
          cols={6}
          rows={1}
          wide
          tone="mint"
          icon={<LuCalendarClock size={14} />}
          label={tt("detail.tenure.label")}
          value={months === null ? "—" : tenureShown}
          caption={
            months === null
              ? tt("detail.tenure.none")
              : years === 0
                ? tt("detail.tenure.months", { count: restMonths })
                : tt("detail.tenure.years", { count: years })
          }
          aside={
            months !== null && years > 0 && restMonths > 0
              ? tt("detail.tenure.plusMonths", { count: restMonths })
              : undefined
          }
        />
        <ITBentoTile
          cols={6}
          rows={1}
          wide
          tone={documents.total > 0 && documents.done === documents.total ? "mint" : "sun"}
          icon={<LuFolderCheck size={14} />}
          label={tt("detail.documentsTile.label")}
          value={`${docsShown}/${documents.total}`}
          caption={
            documents.total === 0
              ? tt("detail.noDocumentTypes")
              : docsLeft === 0
                ? tt("detail.documentsTile.complete")
                : tt("detail.documentsTile.missing", { count: docsLeft })
          }
        />
      </ITBentoGrid>
    </ITFlex>
  );
}

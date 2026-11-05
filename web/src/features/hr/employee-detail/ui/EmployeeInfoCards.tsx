import { useTranslation } from "react-i18next";
import { LuHeartPulse, LuLandmark, LuMapPin, LuPhone, LuUserRound } from "react-icons/lu";
import { ITBentoSegments, ITCard, ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";
import type { PersonalProfile } from "@entities/hr";

const formatDateOnly = (iso?: string | null): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

type Item = { label: string; value?: string | null; wide?: boolean };

function Cell({ item }: { item: Item }) {
  const { t: tt } = useTranslation(["employees"]);
  const has = !!item.value?.trim();
  return (
    <div className={item.wide ? "sm:col-span-2" : ""}>
      <dt className="text-[12px] text-slate-500">{item.label}</dt>
      <dd className={`mt-0.5 break-words text-sm ${has ? "m-0 font-semibold text-slate-800" : "m-0 italic text-slate-400"}`}>
        {has ? item.value : tt("detail.noData")}
      </dd>
    </div>
  );
}

function InfoCard({ icon, tone, title, items }: { icon: React.ReactNode; tone: "primary" | "info" | "warning" | "success" | "danger"; title: string; items: Item[] }) {
  const filled = items.filter((i) => i.value?.trim()).length;
  const complete = filled === items.length;
  return (
    <ITCard>
      <header className="mb-4 flex items-center justify-between gap-3">
        <ITFlex align="center" gap={3} className="min-w-0">
          <ITText as="span"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `var(--color-${tone}-soft)`, color: `var(--color-${tone})` }}
          >
            {icon}
          </ITText>
          <ITText as="h3" className="m-0 truncate !text-[15px] font-bold !text-slate-800">{title}</ITText>
        </ITFlex>
        <ITText as="span"
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums"
          style={{ background: `var(--color-${complete ? "success" : "warning"}-soft)`, color: `var(--color-${complete ? "success" : "warning"})` }}
        >
          {filled}/{items.length}
        </ITText>
      </header>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-4 sm:!grid-cols-2">
        {items.map((i) => (
          <Cell key={i.label} item={i} />
        ))}
      </dl>
    </ITCard>
  );
}

interface Props {
  profile: PersonalProfile;
}

/**
 * Datos del empleado por tema. No repite lo que ya muestra el encabezado (nombre, número, puesto,
 * departamento, rol, ingreso): aquí va solo lo que falta para tener el expediente completo.
 */
export default function EmployeeInfoCards({ profile }: Props) {
  const { t: tt } = useTranslation(["employees"]);
  const f = tt("detail.fields", { returnObjects: true }) as Record<string, string>;
  const sg = tt("detail.subGroups", { returnObjects: true }) as Record<string, string>;

  const groups = [
    { icon: <LuUserRound size={16} />, tone: "primary" as const, title: sg.identification, items: [
      { label: f.secondName, value: profile.middleName },
      { label: f.paternalSurname, value: profile.paternalSurname },
      { label: f.maternalSurname, value: profile.maternalSurname },
      { label: f.birthDate, value: formatDateOnly(profile.birthDate) },
      { label: f.gender, value: profile.gender?.name },
    ] },
    { icon: <LuPhone size={16} />, tone: "info" as const, title: sg.contact, items: [
      { label: f.personalCell, value: profile.personalPhone },
      { label: f.companyCell, value: profile.workPhone },
      { label: f.email, value: profile.email, wide: true },
      { label: f.emergencyContact, value: profile.emergencyContactName },
      { label: f.emergencyPhone, value: profile.emergencyContactPhone },
      { label: f.emergencyRelation, value: profile.emergencyContactRelationship },
    ] },
    { icon: <LuMapPin size={16} />, tone: "warning" as const, title: sg.address, items: [
      { label: f.street, value: profile.streetAddress, wide: true },
      { label: f.colony, value: profile.neighborhood },
      { label: f.zip, value: profile.postalCode },
      { label: f.city, value: profile.city },
      { label: f.state, value: profile.addressState },
      { label: f.country, value: profile.country },
    ] },
    { icon: <LuLandmark size={16} />, tone: "success" as const, title: sg.fiscal, items: [
      { label: f.rfc, value: profile.rfc },
      { label: f.curp, value: profile.curp },
      { label: f.nss, value: profile.nss },
    ] },
    { icon: <LuHeartPulse size={16} />, tone: "danger" as const, title: tt("detail.medicalTitle"), items: [
      { label: f.bloodType, value: profile.bloodType?.name },
      { label: f.condition, value: profile.medicalConditions },
      { label: f.allergies, value: profile.allergies, wide: true },
    ] },
  ];
  const all = groups.flatMap((g) => g.items);
  const filled = all.filter((i) => i.value?.trim()).length;
  const percent = Math.round((filled / all.length) * 100);

  return (
    <ITStack spacing={5}>
      <ITCard>
        <ITFlex align="center" wrap="wrap" gap={6}>
          <div className="min-w-[240px] flex-1">
            <ITText className="m-0 text-[13px] text-slate-500">{tt("detail.completeness")}</ITText>
            <ITText className="m-0 mt-1 text-3xl font-extrabold text-slate-800">
              {filled}
              <ITText as="span" className="text-lg font-semibold text-slate-400"> / {all.length}</ITText>
            </ITText>
            <div className="mt-3">
              <ITBentoSegments total={all.length} done={filled} />
            </div>
            <ITText className="m-0 mt-1 text-[12px] text-slate-500">{percent}%</ITText>
          </div>
          <ITText className="m-0 max-w-sm text-sm text-slate-500">{tt("detail.completenessHint")}</ITText>
        </ITFlex>
      </ITCard>
      <div className="grid grid-cols-1 gap-5 lg:!grid-cols-2 xl:!grid-cols-3">
        {groups.map((g) => (
          <InfoCard key={g.title} icon={g.icon} tone={g.tone} title={g.title} items={g.items} />
        ))}
      </div>
    </ITStack>
  );
}

import { Blobatar } from "@blobatar/react";
import type { IconType } from "react-icons";
import { LuCalendarClock, LuFileChartColumn, LuFingerprint, LuTimer } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { ITFlex, ITText } from "@axzydev/axzy_ui_system";
import logoForDarkBg from "@shared/assets/brand/timemanager-logo-for-dark-bg.svg";
import type { PublicBranding } from "@entities/user";
import "./login.css";

const AVATAR_SEEDS = ["entrada", "comida", "turno-noche", "salida"] as const;

const FEATURES: {
  labelKey:
    | "login.brand.features.clock"
    | "login.brand.features.schedules"
    | "login.brand.features.overtime"
    | "login.brand.features.reports";
  icon: IconType;
}[] = [
  { labelKey: "login.brand.features.clock", icon: LuFingerprint },
  { labelKey: "login.brand.features.schedules", icon: LuCalendarClock },
  { labelKey: "login.brand.features.overtime", icon: LuTimer },
  { labelKey: "login.brand.features.reports", icon: LuFileChartColumn },
];

/**
 * Panel de marca del login: logotipo oficial sobre azul marino con acentos
 * ámbar. En móvil se reduce a la cabecera con el logotipo.
 */
export default function LoginBrandPanel({ branding }: { branding: PublicBranding | null }) {
  const { t: tt } = useTranslation(["auth"]);
  const accent = branding?.brandColor ?? undefined;

  return (
    <aside className="login-brand relative flex flex-col overflow-hidden px-6 py-7 lg:w-1/2 lg:justify-between lg:px-10 lg:py-10">
      <div aria-hidden className="login-ring pointer-events-none absolute -bottom-40 -right-40 h-[26rem] w-[26rem] rounded-full" />
      <div aria-hidden className="login-ring login-ring--accent pointer-events-none absolute -bottom-24 -right-24 h-[18rem] w-[18rem] rounded-full" />

      <div className="login-rise relative">
        <img
          src={branding?.logoDataUrl ?? logoForDarkBg}
          alt={branding?.name ?? tt("login.brand.logoAlt")}
          className="h-[48px] w-auto lg:h-[60px]"
        />
        <ITText className="login-on-brand-muted mt-1 block pl-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]">
          {branding?.name ?? tt("login.brand.eyebrow")}
        </ITText>
        {branding?.name && (
          <ITText className="login-on-brand-muted mt-1 block pl-1 text-[11px] font-semibold tracking-[0.08em]">
            {tt("login.tenantActive")}
          </ITText>
        )}
      </div>

      <div className="relative mt-8 hidden lg:block">
        <ITText as="h2" className="login-on-brand login-rise login-rise-1 max-w-[24rem] text-[30px] font-extrabold leading-[1.08] tracking-tight">
          {tt("login.brand.headline")}{" "}
          <span className="login-accent" style={accent ? { color: accent } : undefined}>
            {tt("login.brand.headlineAccent")}
          </span>
        </ITText>
        <ITText className="login-on-brand-muted login-rise login-rise-2 mt-3 block max-w-[23rem] text-[13.5px] leading-relaxed">
          {tt("login.brand.subcopy")}
        </ITText>

        <div className="login-glass login-rise login-rise-3 mt-6 flex items-center gap-3 rounded-2xl px-3.5 py-3">
          <div aria-hidden className="flex -space-x-2">
            {AVATAR_SEEDS.map((seed) => (
              <Blobatar key={seed} name={seed} size={34} alt="" aria-hidden className="login-avatar h-[34px] w-[34px] rounded-full" />
            ))}
          </div>
          <ITFlex direction="column" gap={0} className="min-w-0">
            <ITText className="login-on-brand text-[13.5px] font-bold leading-tight">{tt("login.brand.teamTitle")}</ITText>
            <ITText className="login-on-brand-muted mt-0.5 block truncate text-[12px] leading-snug">{tt("login.brand.teamText")}</ITText>
          </ITFlex>
        </div>

        <ul className="bento-stagger mt-3 grid grid-cols-2 gap-2.5">
          {FEATURES.map(({ labelKey, icon: Icon }) => (
            <li key={labelKey} className="login-glass flex items-center gap-2.5 rounded-2xl px-3 py-2.5">
              <ITText as="span" aria-hidden className="login-chip flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                <Icon size={16} />
              </ITText>
              <ITText as="span" className="login-on-brand text-[12.5px] font-semibold leading-tight">{tt(labelKey)}</ITText>
            </li>
          ))}
        </ul>
      </div>

      <ITText className="login-on-brand-muted login-rise login-rise-4 relative mt-8 hidden items-center gap-2 text-[12.5px] font-medium lg:flex">
        <span aria-hidden className="login-pulse h-2 w-2 rounded-full" />
        {tt("login.brand.realtime")}
      </ITText>
    </aside>
  );
}

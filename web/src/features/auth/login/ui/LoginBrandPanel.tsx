import { Blobatar } from "@blobatar/react";
import type { IconType } from "react-icons";
import { LuArrowRight, LuBoxes, LuChefHat, LuClock, LuTicket } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import LottieLoader from "@shared/ui/lottie-loader/ui/LottieLoader";
import "./login.css";
import { ITText, ITFlex } from "@axzydev/axzy_ui_system";

/** Semillas fijas y decorativas para los avatares del panel de marca. */
const AVATAR_SEEDS = ["front-desk", "housekeeping", "kitchen", "maintenance"] as const;

const FEATURES: {
  labelKey:
    | "login.brand.features.inventory"
    | "login.brand.features.tickets"
    | "login.brand.features.attendance"
    | "login.brand.features.kitchen";
  icon: IconType;
}[] = [
  { labelKey: "login.brand.features.inventory", icon: LuBoxes },
  { labelKey: "login.brand.features.tickets", icon: LuTicket },
  { labelKey: "login.brand.features.attendance", icon: LuClock },
  { labelKey: "login.brand.features.kitchen", icon: LuChefHat },
];

/**
 * Panel de marca del login, en el lenguaje **bento**: logo compacto, mensaje
 * corto y los módulos como mosaicos de vidrio con entrada escalonada. En móvil
 * se reduce a la cabecera con el logotipo.
 */
export default function LoginBrandPanel() {
  const { t: tt } = useTranslation(["auth"]);

  return (
    <aside className="login-brand relative flex flex-col overflow-hidden px-6 py-7 lg:w-1/2 lg:justify-between lg:px-10 lg:py-10">
      {/* Círculos decorativos */}
      <div aria-hidden className="login-orb pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full" />
      <div aria-hidden className="login-orb login-orb--faint pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full" />

      {/* Marca */}
      <div className="login-rise relative flex items-center gap-3.5">
        <div className="login-logo-tile flex shrink-0 items-center justify-center rounded-[18px] p-1.5">
          <LottieLoader size="sm" label={tt("login.brand.logoAlt")} className="lg:hidden" />
          <LottieLoader size="sm" label={tt("login.brand.logoAlt")} className="hidden lg:block" />
        </div>
        <div className="leading-tight">
          <ITText className="login-on-brand block text-[17px] font-extrabold tracking-tight">
            {tt("login.brand.name")}
          </ITText>
          <ITText className="login-on-brand-muted mt-0.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em]">
            {tt("login.brand.eyebrow")}
          </ITText>
        </div>
      </div>

      {/* Mensaje (solo desktop) */}
      <div className="relative mt-8 hidden lg:block">
        <ITText as="h2" className="login-on-brand login-rise login-rise-1 max-w-[24rem] text-[26px] font-extrabold leading-[1.12] tracking-tight">
          {tt("login.brand.headline")}
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
        <LuArrowRight aria-hidden size={14} />
      </ITText>
    </aside>
  );
}

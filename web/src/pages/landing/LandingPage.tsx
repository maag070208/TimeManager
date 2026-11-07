import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import {
  LuArrowRight,
  LuBell,
  LuCalendarCheck,
  LuCheck,
  LuFileLock2,
  LuFingerprint,
  LuHouse,
  LuLayers,
  LuLaptop,
  LuMenu,
  LuMoon,
  LuPlus,
  LuScale,
  LuServer,
  LuSmartphone,
  LuSun,
  LuTimer,
  LuUsers,
  LuWifiOff,
  LuX,
} from "react-icons/lu";
import HeroConsole from "./ui/HeroConsole";
import {
  AgentVisual,
  AlertsVisual,
  AuditVisual,
  CellHead,
  OvertimeVisual,
  PayrollVisual,
  PortalVisual,
  ReformVisual,
  TeleworkVisual,
  TenantsVisual,
} from "./ui/BentoCells";
import "./landing.css";

const DEMO_URL =
  "mailto:hola@axzy.dev?subject=" +
  encodeURIComponent("Demo de CheckLab") +
  "&body=" +
  encodeURIComponent("Hola, quiero una demo de CheckLab. Mi empresa es ___ y tenemos aprox. ___ personas.");

const NAV = [
  { id: "producto", label: "Producto" },
  { id: "cumplimiento", label: "Cumplimiento" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "planes", label: "Planes" },
  { id: "faq", label: "Preguntas" },
];

const FACTS = [
  { value: "0", label: "checadas editables", sub: "se corrigen con ajuste aprobado" },
  { value: "5 min", label: "sincronización del reloj", sub: "automática, sin abrir puertos" },
  { value: "12 h", label: "tope diario vigilado", sub: "con alerta a RH" },
  { value: "48→40 h", label: "transición LFT", sub: "aplicada semana a semana" },
];

const INDUSTRIES = ["Logística", "Salud", "Restaurantes", "Manufactura", "Retail", "Seguridad privada"];

const COMPLIANCE = [
  "Inicio y fin de jornada de todas las modalidades: reloj, web y teletrabajo",
  "Checadas inmutables; cada corrección con motivo y aprobador distinto",
  "Horas extra al doble y al triple con los topes de los arts. 66 y 68",
  "Acuerdo del método de registro y constancia semanal del trabajador",
  "Convenios de distribución de jornada para turnos nocturnos",
  "Teletrabajo NOM-037: política, consentimiento, checklist y desconexión",
  "Export de registros para la autoridad con hash de integridad",
  "Retención y archivo de registros configurable por cliente",
];

const STEPS = [
  {
    icon: LuServer,
    title: "Instalamos el reloj",
    text: "Un Hikvision de rostro y huella por sitio. Damos de alta a tu personal desde CheckLab, sin capturar en el equipo.",
  },
  {
    icon: LuLaptop,
    title: "Conectamos el agente",
    text: "CheckLab Agent corre en una PC de tu red, lee el reloj y sube las checadas. Sin VPN y con cola local si falla el internet.",
  },
  {
    icon: LuCalendarCheck,
    title: "Tu equipo opera",
    text: "Horarios, retardos, horas extra y pre-nómina se calculan solos. RH revisa, aprueba y cierra la semana.",
  },
];

const PLANS = [
  {
    name: "Básico",
    price: "500",
    people: "Hasta 500 personas",
    clocks: "1 reloj",
    features: ["Checadas y asistencia", "Personal y expedientes", "Portal del trabajador", "Reportes y export"],
    highlight: false,
  },
  {
    name: "Profesional",
    price: "750",
    people: "Hasta 750 personas",
    clocks: "2 relojes",
    features: ["Todo lo del Básico", "Horarios y pre-nómina", "Agente local incluido", "Roles adicionales"],
    highlight: true,
  },
  {
    name: "Empresarial",
    price: "1,000",
    people: "Hasta 1,000 personas",
    clocks: "3 relojes",
    features: ["Todo lo del Profesional", "Varias sucursales", "Consola multi-empresa", "Soporte prioritario"],
    highlight: false,
  },
];

const FAQ = [
  {
    q: "¿CheckLab cumple con el registro electrónico de jornada?",
    a: "Registra inicio y fin de jornada de todas las modalidades (reloj, web y teletrabajo), guarda las checadas de forma inmutable, documenta cada corrección con su aprobador y genera el export de registros con hash. El formato oficial y la retención definitiva dependen de las disposiciones que publique la STPS; el sistema está hecho para ajustarse a ellas.",
  },
  {
    q: "¿Cómo calcula las horas extra?",
    a: "Compara lo trabajado contra el horario de cada persona y clasifica la semana con las reglas de la LFT: horas al doble hasta el tope del año, excedente al triple y lo que rebasa la ley marcado como infracción. Cuando la jornada ordinaria baje rumbo a 40 horas, el tope se aplica según el año de cada semana.",
  },
  {
    q: "¿Cómo se conecta el reloj checador?",
    a: "Instalamos un reloj Hikvision en tu sitio y el CheckLab Agent (app de escritorio) se conecta a él por tu red local, lee las checadas y las envía al sistema. No necesitas abrir puertos ni contratar VPN: el agente solo hace conexiones de salida.",
  },
  {
    q: "¿Sirve para home office y personal en campo?",
    a: "Sí. Cada persona tiene su portal Mi jornada para marcar entrada y salida desde el teléfono, ver sus marcajes y reportar discrepancias. La ubicación es opcional y solo se toma en el momento del marcaje.",
  },
  {
    q: "¿Qué pasa si se cae el internet del sitio?",
    a: "El agente guarda las checadas en una cola local y las reenvía cuando vuelve la conexión. La ingesta es idempotente: aunque reintente, nunca duplica marcajes.",
  },
  {
    q: "¿Puedo cambiar de plan o dar de baja a alguien?",
    a: "Sí. Los planes se miden por personas activas y relojes. Dar de baja libera lugar, y bajar de plan no borra información: solo limita nuevas altas por encima del límite.",
  },
];

const Logo = ({ className = "h-8" }: { className?: string }) => (
  <>
    <img src="/brand/svg/checklab-logo-for-light-bg.svg" alt="CheckLab" className={`cl-logo-light w-auto ${className}`} />
    <img src="/brand/svg/checklab-logo-for-dark-bg.svg" alt="CheckLab" className={`cl-logo-dark w-auto ${className}`} />
  </>
);

const SectionHead = ({ id, eyebrow, title, text }: { id?: string; eyebrow: string; title: string; text?: string }) => (
  <div id={id} className="mx-auto max-w-2xl scroll-mt-24 text-center" data-reveal>
    <span className="cl-eyebrow">{eyebrow}</span>
    <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">{title}</h2>
    {text && <p className="cl-muted mx-auto mt-4 max-w-xl text-pretty text-[15px] leading-relaxed">{text}</p>}
  </div>
);

/** Spotlight del bento: el halo sigue al puntero dentro de cada tarjeta. */
const trackPointer = (event: PointerEvent<HTMLDivElement>) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>(".cl-card");
  if (!card || card.parentElement !== event.currentTarget) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  card.style.setProperty("--my", `${event.clientY - rect.top}px`);
};

const readTheme = (): "light" | "dark" => {
  try {
    const saved = window.localStorage.getItem("cl-landing-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Almacenamiento bloqueado: se usa la preferencia del sistema.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export default function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">(readTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("cl-landing-theme", theme);
    } catch {
      // Sin almacenamiento el tema solo dura la visita.
    }
  }, [theme]);

  useEffect(() => {
    const previous = document.title;
    document.title = "CheckLab · Registro de jornada con prueba plena";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    const nodes = root.current?.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!nodes?.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    nodes.forEach((node, index) => {
      node.style.transitionDelay = `${(index % 4) * 60}ms`;
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} className="cl-landing relative min-h-screen antialiased" data-theme={theme}>
      <div className="cl-backdrop" aria-hidden="true" />

      {/* ── Navegación ───────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ borderColor: "var(--line)", backgroundColor: "color-mix(in srgb, var(--bg) 80%, transparent)", backdropFilter: "blur(14px)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#top" aria-label="CheckLab, inicio">
            <Logo className="h-7 sm:h-8" />
          </a>
          <nav className="hidden items-center gap-7 text-[13px] font-semibold md:flex" aria-label="Secciones">
            {NAV.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="cl-link">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cl-icon-btn"
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
              aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            >
              {theme === "dark" ? <LuSun size={16} /> : <LuMoon size={16} />}
            </button>
            <Link to="/login" className="cl-link hidden px-2 text-[13px] font-semibold sm:block">
              Iniciar sesión
            </Link>
            <a href={DEMO_URL} className="cl-btn cl-btn-primary hidden !px-4 !py-2.5 text-[13px] sm:inline-flex">
              Solicitar demo
            </a>
            <button
              type="button"
              className="cl-icon-btn md:hidden"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <LuX size={17} /> : <LuMenu size={17} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t px-4 py-4 md:hidden" style={{ borderColor: "var(--line)", background: "var(--bg)" }} aria-label="Secciones">
            <div className="grid gap-3 text-sm font-semibold">
              {NAV.map((item) => (
                <a key={item.id} href={`#${item.id}`} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to="/login" className="cl-btn cl-btn-ghost">
                  Iniciar sesión
                </Link>
                <a href={DEMO_URL} className="cl-btn cl-btn-primary">
                  Solicitar demo
                </a>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section id="top" className="mx-auto grid max-w-6xl gap-14 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.02fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-24">
          <div data-reveal>
            <span className="cl-chip">
              <span className="cl-pulse" /> Listo para la reforma de 40 horas
            </span>
            <h1 className="mt-6 text-balance text-[2.6rem] font-black leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
              Cada checada cuenta.{" "}
              <span className="cl-mint">Y se puede comprobar.</span>
            </h1>
            <p className="cl-muted mt-6 max-w-xl text-pretty text-[16px] leading-relaxed sm:text-[17px]">
              Reloj, web y teletrabajo en un solo registro de jornada. Horarios, retardos, horas extra al doble y al
              triple y pre-nómina que se calculan solos, con la prueba que pide la ley.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={DEMO_URL} className="cl-btn cl-btn-primary">
                Solicitar demo <LuArrowRight size={16} />
              </a>
              <a href="#producto" className="cl-btn cl-btn-ghost">
                Ver el producto
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold">
              {["Sin VPN ni puertos abiertos", "Datos aislados por empresa", "Soporte en español"].map((item) => (
                <li key={item} className="cl-muted flex items-center gap-1.5">
                  <LuCheck size={15} className="cl-mint" strokeWidth={3} /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal className="lg:pl-4">
            <HeroConsole />
          </div>
        </section>

        {/* ── Industrias y cifras ──────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div data-reveal className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13px] font-semibold">
            <span className="cl-faint">Hecho para operaciones con turnos:</span>
            {INDUSTRIES.map((item) => (
              <span key={item} className="cl-muted">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-10 grid grid-cols-2 overflow-hidden rounded-[26px] border lg:grid-cols-4" style={{ borderColor: "var(--line)", background: "var(--line)", gap: "1px" }}>
            {FACTS.map((fact) => (
              <div key={fact.label} data-reveal className="px-5 py-6 sm:px-7" style={{ background: "var(--surface)" }}>
                <p className="text-3xl font-black tracking-tight sm:text-4xl">{fact.value}</p>
                <p className="mt-1 text-[13px] font-bold">{fact.label}</p>
                <p className="cl-faint text-[12px]">{fact.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bento del producto ───────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
          <SectionHead
            id="producto"
            eyebrow="Producto"
            title="Todo el registro de jornada, en un solo lugar"
            text="De la checada en el reloj al cierre de la pre-nómina: cada pieza conectada, auditable y pensada para RH."
          />

          <div className="cl-bento mt-14 grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12" onPointerMove={trackPointer}>
            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-6 lg:col-span-7">
              <CellHead
                icon={LuTimer}
                label="Motor de horas extra"
                title="Doble, triple y fuera de ley, sin hojas de cálculo"
                text="Cada semana se clasifica con las reglas de la LFT: tope al doble del año, excedente al triple, máximo de días y de horas por día. RH aprueba y la nómina recibe cifras cerradas."
              />
              <OvertimeVisual />
            </article>

            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-6 lg:col-span-5">
              <CellHead
                icon={LuFingerprint}
                label="Reloj y agente local"
                title="Tu reloj, conectado sin tocar la red"
                text="El agente habla con el reloj por la red local y sube las checadas a la nube. Si se cae el internet, nada se pierde."
              />
              <AgentVisual />
              <div className="cl-panel mt-auto flex items-center gap-3 px-4 py-3">
                <LuWifiOff size={18} className="cl-mint shrink-0" />
                <p className="cl-muted text-[12.5px] leading-snug">
                  Alta y baja del personal en el reloj desde CheckLab, con padrón que detecta a quien dejó de checar.
                </p>
              </div>
            </article>

            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-3 lg:col-span-4">
              <CellHead
                icon={LuSmartphone}
                label="Mi jornada"
                title="Home office y campo, desde el teléfono"
                text="Marcaje web con ubicación solo al marcar, historial y discrepancias del propio trabajador."
              />
              <PortalVisual />
            </article>

            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-3 lg:col-span-8">
              <CellHead
                icon={LuFileLock2}
                label="Prueba plena"
                title="Nada se borra. Todo se explica."
                text="La checada original nunca cambia. Cada corrección lleva motivo, quién la pidió y quién la aprobó, y el export para la autoridad sale con hash de integridad."
              />
              <AuditVisual />
              <div className="mt-auto grid gap-3 sm:grid-cols-2">
                <div className="cl-panel px-4 py-3">
                  <p className="text-[12.5px] font-bold">Acuerdo del método de registro</p>
                  <p className="cl-faint text-[11.5px]">Firmado por trabajador y empresa, con fecha, IP y hash.</p>
                </div>
                <div className="cl-panel px-4 py-3">
                  <p className="text-[12.5px] font-bold">Constancia semanal</p>
                  <p className="cl-faint text-[11.5px]">El trabajador acepta su semana o reporta una discrepancia.</p>
                </div>
              </div>
            </article>

            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-3 lg:col-span-4">
              <CellHead icon={LuCalendarCheck} label="Pre-nómina" title="Revisa por área, cierra la semana" text="Cada departamento se revisa y la semana se cierra con una fotografía de las cifras." />
              <PayrollVisual />
            </article>

            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-3 lg:col-span-4">
              <CellHead icon={LuBell} label="Alertas" title="Te avisa antes del problema" text="Jornadas de más de 12 horas, ajustes por aprobar y bajas del reloj llegan a RH." />
              <AlertsVisual />
            </article>

            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-6 lg:col-span-4">
              <CellHead icon={LuHouse} label="Teletrabajo NOM-037" title="Teletrabajo en regla" text="Política y aviso con consentimiento, checklist del lugar de trabajo y desconexión digital." />
              <TeleworkVisual />
            </article>

            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-6 lg:col-span-6">
              <CellHead
                icon={LuLayers}
                label="Varias empresas o sucursales"
                title="Cada cliente, su propio espacio"
                text="Subdominio, marca, planes y límites por cliente. Los datos de cada empresa quedan aislados desde la base de datos."
              />
              <TenantsVisual />
            </article>

            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-6 lg:col-span-6" style={{ background: "linear-gradient(160deg, var(--surface) 55%, var(--mint-soft))" }}>
              <CellHead
                icon={LuScale}
                label="Reforma laboral"
                title="De 48 a 40 horas, año por año"
                text="La jornada ordinaria baja dos horas por año desde 2027 y el tope al doble sube. CheckLab aplica el límite que corresponde a cada semana."
              />
              <ReformVisual />
            </article>
          </div>
        </section>

        {/* ── Cumplimiento ─────────────────────────────────────── */}
        <section id="cumplimiento" className="scroll-mt-20 px-4 sm:px-6">
          <div data-reveal className="mx-auto max-w-6xl overflow-hidden rounded-[32px] p-7 sm:p-12" style={{ background: "var(--navy)", color: "#F4F6FA" }}>
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <span className="cl-eyebrow" style={{ color: "#34D399" }}>
                  Cumplimiento
                </span>
                <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                  El registro electrónico que la ley ya pide
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "rgba(244,246,250,0.72)" }}>
                  La reforma a la Ley Federal del Trabajo obliga a registrar electrónicamente el inicio y fin de la jornada
                  de cada trabajador. CheckLab cubre el flujo completo y deja el rastro auditable.
                </p>
                <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "rgba(244,246,250,0.5)" }}>
                  El formato oficial y la retención definitiva dependen de las disposiciones que publique la STPS.
                </p>
              </div>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {COMPLIANCE.map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-2xl px-4 py-3.5 text-[13px] leading-snug" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: "#34D399", color: "#06281C" }}>
                      <LuCheck size={12} strokeWidth={3.5} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Cómo funciona ────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
          <SectionHead id="como-funciona" eyebrow="Cómo funciona" title="Operando en días, no en meses" text="Nos encargamos de la instalación; tu equipo solo aprende a revisar y aprobar." />
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} data-reveal className="cl-card p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "var(--mint-soft)", color: "var(--mint)" }}>
                    <Icon size={20} />
                  </span>
                  <span className="text-4xl font-black tabular-nums tracking-tight" style={{ color: "var(--line-strong)" }}>
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
                <p className="cl-muted mt-2 text-[13.5px] leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Planes ───────────────────────────────────────────── */}
        <section id="planes" className="scroll-mt-20 border-y" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
            <SectionHead eyebrow="Planes" title="Precio simple, por tamaño de empresa" text="Elige por personas activas y relojes. Cambia de plan cuando quieras sin perder información." />
            <div className="mt-14 grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <article
                  key={plan.name}
                  data-reveal
                  className="cl-card flex flex-col p-7"
                  style={plan.highlight ? { borderColor: "var(--mint)", boxShadow: "0 0 0 1px var(--mint), var(--shadow)" } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold">{plan.name}</h3>
                    {plan.highlight && <span className="cl-tag cl-tag-mint">Más elegido</span>}
                  </div>
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span className="cl-faint text-[13px] font-semibold">desde</span>
                    <span className="text-4xl font-black tracking-tight">${plan.price}</span>
                    <span className="cl-muted text-[13px] font-semibold">MXN/mes</span>
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="cl-chip">
                      <LuUsers size={12} /> {plan.people}
                    </span>
                    <span className="cl-chip">
                      <LuFingerprint size={12} /> {plan.clocks}
                    </span>
                  </div>
                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-[13.5px]">
                        <LuCheck size={16} className="cl-mint mt-0.5 shrink-0" strokeWidth={3} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a href={DEMO_URL} className={`cl-btn mt-8 w-full ${plan.highlight ? "cl-btn-primary" : "cl-btn-ghost"}`}>
                    Solicitar demo
                  </a>
                </article>
              ))}
            </div>
            <p className="cl-faint mt-6 text-center text-[12px]">Precios de referencia; los definitivos se confirman en la demo.</p>
          </div>
        </section>

        {/* ── Preguntas ────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:py-28">
          <SectionHead id="faq" eyebrow="Preguntas frecuentes" title="Lo que suelen preguntarnos" />
          <div className="mt-12 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} data-reveal className="cl-card cl-faq !rounded-[20px] px-5 py-4">
                <summary className="flex items-center justify-between gap-4 text-[14.5px] font-bold">
                  {item.q}
                  <LuPlus size={17} className="cl-faq-icon cl-muted shrink-0" />
                </summary>
                <p className="cl-muted mt-3 text-[13.5px] leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Llamado final ────────────────────────────────────── */}
        <section className="px-4 pb-24 sm:px-6">
          <div data-reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] px-6 py-14 text-center sm:px-14 sm:py-20" style={{ background: "var(--navy)", color: "#F4F6FA" }}>
            <img src="/brand/svg/checklab-symbol-for-dark-bg.svg" alt="" aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 opacity-[0.07] sm:h-80 sm:w-80" />
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-black tracking-tight sm:text-5xl">
              Llega a la reforma con el registro de jornada resuelto
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed" style={{ color: "rgba(244,246,250,0.72)" }}>
              Te mostramos CheckLab con una operación de turnos completa. Si te convence, instalamos el reloj y el agente
              y tu equipo empieza a operar en días.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={DEMO_URL} className="cl-btn cl-btn-amber">
                Solicitar demo <LuArrowRight size={16} />
              </a>
              <Link to="/login" className="cl-btn" style={{ border: "1px solid rgba(244,246,250,0.25)", color: "#F4F6FA" }}>
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo className="h-7" />
          <p className="cl-faint text-[12px]">Registro de jornada, asistencia y pre-nómina · Hecho por AXZY</p>
          <div className="flex gap-5 text-[12.5px] font-semibold">
            <a href="#cumplimiento" className="cl-link">
              Cumplimiento
            </a>
            <a href="#planes" className="cl-link">
              Planes
            </a>
            <Link to="/login" className="cl-link">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

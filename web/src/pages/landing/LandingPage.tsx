import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuArrowRight,
  LuBadgeCheck,
  LuBell,
  LuCalendarCheck,
  LuCheck,
  LuChevronDown,
  LuClock,
  LuFileText,
  LuFingerprint,
  LuLayers,
  LuLaptop,
  LuMapPin,
  LuMenu,
  LuMoon,
  LuServer,
  LuShieldCheck,
  LuSmartphone,
  LuSparkles,
  LuSun,
  LuUsers,
  LuWifiOff,
  LuX,
} from "react-icons/lu";
import "./landing.css";

const DEMO_URL =
  "mailto:hola@axzy.dev?subject=" +
  encodeURIComponent("Demo de TimeManager") +
  "&body=" +
  encodeURIComponent("Hola, quiero una demo de TimeManager. Mi empresa es ___ y tenemos aprox. ___ personas.");

const NAV = [
  { id: "producto", label: "Producto" },
  { id: "reloj", label: "Reloj y agente" },
  { id: "cumplimiento", label: "Cumplimiento" },
  { id: "planes", label: "Planes" },
  { id: "faq", label: "Preguntas" },
];

const TRUST = [
  { icon: LuShieldCheck, text: "Alineado a la reforma LFT 2027" },
  { icon: LuLayers, text: "Multi-cliente con datos aislados" },
  { icon: LuWifiOff, text: "Agente local: no necesitas VPN" },
  { icon: LuSmartphone, text: "Portal móvil para tu personal" },
];

const NOM_CHECKS = [
  "Registro de entrada y salida de todas las modalidades",
  "Inmutabilidad de checadas y ajustes auditados",
  "Límites de jornada 12 h/día y 46 → 40 h semanales",
  "Export de registros para la autoridad (STPS)",
  "Portal con discrepancia del trabajador",
  "Teletrabajo y desconexión NOM-037",
];

const PLANS = [
  {
    name: "Básico",
    people: "500 personas",
    clocks: "1 reloj",
    price: "desde $500 MXN/mes",
    features: ["Checadas y asistencia", "Personal y expedientes", "Portal del trabajador", "Reportes y export"],
    highlight: false,
  },
  {
    name: "Profesional",
    people: "750 personas",
    clocks: "2 relojes",
    price: "desde $750 MXN/mes",
    features: ["Todo lo del Básico", "Horarios y pre-nómina", "Agente local incluido", "Roles adicionales"],
    highlight: true,
  },
  {
    name: "Empresarial",
    people: "1,000 personas",
    clocks: "3 relojes",
    price: "desde $1,000 MXN/mes",
    features: ["Todo lo del Profesional", "Multi-sucursal", "Consola de plataforma", "Soporte prioritario"],
    highlight: false,
  },
];

const FAQ = [
  {
    q: "¿TimeManager cumple con el registro electrónico de jornada?",
    a: "El sistema registra inicio y fin de jornada de todas las modalidades (reloj, acceso y marcaje remoto), guarda las checadas de forma inmutable, documenta cada corrección con su aprobador y genera el export de registros con hash. El formato oficial y la retención definitiva dependen de las disposiciones que publique la STPS para 2027; el sistema queda listo para ajustarse.",
  },
  {
    q: "¿Cómo se conecta el reloj checador?",
    a: "Instalamos un reloj Hikvision en tu sitio y el TimeManagerAgent (app de escritorio) se conecta a él por tu red local, lee las checadas y las envía al sistema en bloques configurables. No necesitas abrir puertos ni contratar VPN: el agente solamente hace conexiones de salida.",
  },
  {
    q: "¿Sirve para home office y personal en campo?",
    a: "Sí. Además del reloj, cada persona tiene su portal Mi jornada para marcar entrada y salida desde el teléfono, consultar sus marcajes y reportar discrepancias. La ubicación es opcional y solo se comparte en el momento del marcaje.",
  },
  {
    q: "¿Qué pasa si se cae el internet del sitio?",
    a: "El agente guarda las checadas en una cola local y las reenvía cuando vuelve la conexión. La ingesta es idempotente: aunque reintente, nunca duplica marcajes.",
  },
  {
    q: "¿Puedo cambiar de plan o dar de baja a alguien?",
    a: "Sí. Los planes se administran por número de personas activas y relojes; dar de baja libera lugar y bajar de plan no borra información, solo bloquea altas nuevas por encima del límite.",
  },
];

const ThemeToggle = ({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    className="lp-card flex h-10 w-10 items-center justify-center !rounded-full"
    style={{ color: "var(--lp-fg)" }}
  >
    {theme === "dark" ? <LuSun size={17} /> : <LuMoon size={17} />}
  </button>
);

const BrowserFrame = ({
  src,
  alt,
  url,
  className = "",
}: {
  src: string;
  alt: string;
  url: string;
  className?: string;
}) => (
  <div className={`lp-browser ${className}`}>
    <div className="lp-browser-bar">
      <span className="lp-browser-dot" />
      <span className="lp-browser-dot" />
      <span className="lp-browser-dot" />
      <span className="lp-browser-url">{url}</span>
    </div>
    <img src={src} alt={alt} loading="lazy" className="block w-full" />
  </div>
);

const SectionTitle = ({
  eyebrow,
  title,
  text,
  id,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  id?: string;
}) => (
  <div id={id} className="mx-auto max-w-2xl scroll-mt-24 text-center" data-reveal>
    <span
      className="lp-chip"
      style={{ borderColor: "var(--lp-line)", color: "var(--lp-accent-ink)" }}
    >
      <LuSparkles size={13} />
      {eyebrow}
    </span>
    <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-[2.5rem] sm:leading-[1.1]">
      {title}
    </h2>
    {text && <p className="lp-muted mx-auto mt-3 max-w-xl text-pretty text-[15px] leading-relaxed">{text}</p>}
  </div>
);

export default function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("tm-landing-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.setItem("tm-landing-theme", theme);
  }, [theme]);

  // Aparición suave de secciones y tarjetas al hacer scroll.
  useEffect(() => {
    const nodes = root.current?.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!nodes?.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    nodes.forEach((node, index) => {
      node.style.transitionDelay = `${Math.min(index % 5, 4) * 55}ms`;
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <div
      ref={root}
      className="tm-landing min-h-screen scroll-smooth antialiased"
      data-theme={theme}
      style={{ fontFamily: "inherit" }}
    >
      <div className="lp-grid-bg">
        {/* ── Nav ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b" style={{ borderColor: "var(--lp-line)", backgroundColor: "color-mix(in srgb, var(--lp-bg) 82%, transparent)", backdropFilter: "blur(14px)" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <a href="#top" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--lp-navy)" }}>
                <LuClock size={19} style={{ color: "var(--lp-accent)" }} />
              </span>
              <span className="text-[15px] font-extrabold tracking-tight">
                Time<span className="lp-accent">Manager</span>
              </span>
            </a>

            <nav className="hidden items-center gap-7 text-[13px] font-semibold md:flex" style={{ color: "var(--lp-muted)" }}>
              {NAV.map((item) => (
                <a key={item.id} href={`#${item.id}`} className="lp-nav-link transition-colors hover:opacity-100">
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              <Link to="/login" className="lp-btn-primary lp-nav-cta !px-4 !py-2.5 text-[13px]">
                Iniciar sesión
              </Link>
              <button
                type="button"
                aria-label="Abrir menú"
                onClick={() => setMenuOpen((v) => !v)}
                className="lp-card flex h-10 w-10 items-center justify-center !rounded-full md:hidden"
                style={{ color: "var(--lp-fg)" }}
              >
                {menuOpen ? <LuX size={18} /> : <LuMenu size={18} />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="border-t px-4 py-4 md:hidden" style={{ borderColor: "var(--lp-line)", backgroundColor: "var(--lp-bg)" }}>
              <nav className="grid gap-3 text-sm font-semibold" style={{ color: "var(--lp-fg)" }}>
                {NAV.map((item) => (
                  <a key={item.id} href={`#${item.id}`} onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </a>
                ))}
                <Link to="/login" className="lp-btn-primary mt-2">
                  Iniciar sesión
                </Link>
              </nav>
            </div>
          )}
        </header>

        {/* ── Hero ────────────────────────────────────────────── */}
        <section id="top" className="relative isolate mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
          <div className="lp-aurora" aria-hidden="true" />
          <div className="relative z-10" data-reveal>
            <span className="lp-chip" style={{ color: "var(--lp-accent-ink)" }}>
              <LuBadgeCheck size={14} />
              Registro electrónico LFT 2027 · NOM-037
            </span>
            <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              El registro de jornada que tu empresa{" "}
              <span className="lp-accent">va a necesitar</span>.
            </h1>
            <p className="lp-muted mt-5 max-w-xl text-pretty text-[15px] leading-relaxed sm:text-base">
              Checadas con reloj Hikvision, asistencia, horarios, horas extra y expedientes en un solo sistema
              multi-cliente. Con agente local para la red de cada empresa y portal móvil para su personal.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href={DEMO_URL} className="lp-btn-primary">
                Solicitar demo
                <LuArrowRight size={16} />
              </a>
              <Link to="/login" className="lp-btn-ghost">
                Entrar al sistema
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              <span className="lp-chip"><LuShieldCheck size={13} /> Inmutable y auditable</span>
              <span className="lp-chip"><LuLayers size={13} /> Multi-cliente</span>
              <span className="lp-chip"><LuWifiOff size={13} /> Trabaja sin VPN</span>
            </div>
          </div>

          <div className="relative z-10" data-reveal>
            <BrowserFrame src="/landing/home.jpg" alt="Inicio del cliente con asistencia y personal" url="acme.timemanager.mx" />
            <div className="lp-card lp-float absolute -bottom-6 -left-2 hidden max-w-[220px] p-4 sm:block">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--lp-glow)", color: "var(--lp-accent-ink)" }}>
                  <LuCheck size={15} />
                </span>
                <div>
                  <p className="text-[12px] font-bold">Asistencia al día</p>
                  <p className="lp-muted text-[11px]">Entradas, retardos y ubicaciones</p>
                </div>
              </div>
            </div>
            <div className="lp-card lp-float-soft absolute -right-2 -top-5 hidden items-center gap-2 !rounded-full px-4 py-2 font-bold sm:flex">
              <span className="h-2 w-2 rounded-full" style={{ background: "#22c55e" }} />
              <span className="text-[12px]">Reloj conectado</span>
            </div>
          </div>
        </section>

        {/* ── Trust strip ─────────────────────────────────────── */}
        <section className="border-y" style={{ borderColor: "var(--lp-line)", backgroundColor: "var(--lp-surface-2)" }}>
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <Icon size={16} style={{ color: "var(--lp-accent-ink)" }} />
                <span className="text-[12.5px] font-semibold" style={{ color: "var(--lp-muted)" }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bento producto ──────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionTitle
            id="producto"
            eyebrow="Un solo sistema"
            title="Todo lo que tu operación necesita, en un tablero"
            text="Diseñado para RH y administración: la persona, su horario, sus checadas y su expediente conectados."
          />

          <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Asistencia */}
            <article data-reveal className="lp-card overflow-hidden lg:col-span-7">
              <div className="flex items-start justify-between gap-4 p-6 pb-0 sm:p-7">
                <div>
                  <span className="lp-chip"><LuClock size={13} /> Asistencia</span>
                  <h3 className="mt-3 text-xl font-extrabold tracking-tight">Entradas, salidas y retardos en vivo</h3>
                  <p className="lp-muted mt-1.5 max-w-sm text-[13.5px] leading-relaxed">
                    Resumen de hoy, retardos y conciliación del reloj contra el sistema, sin descargar hojas de cálculo.
                  </p>
                </div>
              </div>
              <div className="mt-5 px-4 pb-4 sm:px-6 sm:pb-6">
                <BrowserFrame className="lp-shot" src="/landing/attendance.jpg" alt="Pantalla de entradas y salidas" url="acme.timemanager.mx/#/hr/time-clock/entries-exits" />
              </div>
            </article>

            {/* Personal */}
            <article data-reveal className="lp-card flex flex-col overflow-hidden lg:col-span-5">
              <div className="p-6 sm:p-7">
                <span className="lp-chip"><LuUsers size={13} /> Personal</span>
                <h3 className="mt-3 text-xl font-extrabold tracking-tight">Una persona, una cuenta</h3>
                <p className="lp-muted mt-1.5 text-[13.5px] leading-relaxed">
                  Expediente, cuenta, permisos y baja lógica en una sola pantalla. Sin duplicados ni listas paralelas.
                </p>
              </div>
              <div className="mt-auto px-4 pb-4 sm:px-6 sm:pb-6">
                <BrowserFrame className="lp-shot" src="/landing/personal.jpg" alt="Listado de personal" url="acme.timemanager.mx/#/employees" />
              </div>
            </article>

            {/* Horarios y pre-nómina */}
            <article data-reveal className="lp-card overflow-hidden lg:col-span-5">
              <div className="p-6 sm:p-7">
                <span className="lp-chip"><LuCalendarCheck size={13} /> Horarios y nómina</span>
                <h3 className="mt-3 text-xl font-extrabold tracking-tight">Turnos, tolerancias y pre-nómina</h3>
                <p className="lp-muted mt-1.5 text-[13.5px] leading-relaxed">
                  Reglas por horario para retardos y tiempo extra, cierres semanales y revisión por departamento.
                </p>
              </div>
              <div className="mt-4 px-4 pb-4 sm:px-6 sm:pb-6">
                <BrowserFrame className="lp-shot" src="/landing/schedules.jpg" alt="Pantalla de horarios" url="acme.timemanager.mx/#/schedules" />
              </div>
            </article>

            {/* Portal del trabajador */}
            <article data-reveal className="lp-card overflow-hidden lg:col-span-7">
              <div className="grid gap-6 p-6 sm:grid-cols-[1fr_260px] sm:p-7">
                <div>
                  <span className="lp-chip"><LuSmartphone size={13} /> Portal del trabajador</span>
                  <h3 className="mt-3 text-xl font-extrabold tracking-tight">Mi jornada, desde el teléfono</h3>
                  <p className="lp-muted mt-1.5 text-[13.5px] leading-relaxed">
                    Home office, campo y teletrabajo: marcar entrada y salida, consultar marcajes y reportar
                    discrepancias. Ubicación opcional y solo al momento del marcaje.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {["Marcaje remoto sin reloj", "Portal responsive para cualquier teléfono", "Teletrabajo, desconexión y consentimiento"].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[13px]">
                        <LuCheck size={15} className="mt-0.5 shrink-0" style={{ color: "var(--lp-accent-ink)" }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="self-center">
                  <div className="lp-phone">
                    <img src="/landing/portal-mobile.jpg" alt="Portal Mi jornada en el teléfono" loading="lazy" />
                  </div>
                </div>
              </div>
            </article>

            {/* Reloj + agente */}
            <article data-reveal className="lp-card lp-brand-card overflow-hidden lg:col-span-6">
              <div className="p-6 sm:p-7">
                <span className="lp-chip">
                  <LuFingerprint size={13} /> Reloj y agente local
                </span>
                <h3 className="mt-3 text-xl font-extrabold tracking-tight">
                  Tu reloj Hikvision, sin abrir la red
                </h3>
                <p className="mt-2 max-w-md text-[13.5px] leading-relaxed">
                  El TimeManagerAgent se instala en una PC del cliente, se conecta al reloj por LAN y envía las
                  checadas al sistema en bloques configurables. Cola local si se cae el internet.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                  <span className="lp-chip">Reloj</span>
                  <LuArrowRight size={14} className="lp-muted" />
                  <span className="lp-chip">Agente</span>
                  <LuArrowRight size={14} className="lp-muted" />
                  <span className="lp-chip">API TimeManager</span>
                </div>
              </div>
              <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                <BrowserFrame className="lp-shot" src="/landing/time-clocks.jpg" alt="Configuración de relojes" url="acme.timemanager.mx/#/time-clocks" />
              </div>
            </article>

            {/* Multi-cliente y planes */}
            <article data-reveal className="lp-card overflow-hidden lg:col-span-6">
              <div className="p-6 sm:p-7">
                <span className="lp-chip"><LuLayers size={13} /> Multi-cliente</span>
                <h3 className="mt-3 text-xl font-extrabold tracking-tight">Cada cliente, su espacio</h3>
                <p className="lp-muted mt-1.5 text-[13.5px] leading-relaxed">
                  Consola de plataforma con clientes, planes y uso. Los datos de cada empresa quedan aislados y con
                  límites de personal y relojes por plan.
                </p>
              </div>
              <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                <BrowserFrame className="lp-shot" src="/landing/platform.jpg" alt="Consola de clientes de plataforma" url="timemanager.mx" />
              </div>
            </article>

            {/* Cumplimiento */}
            <article id="cumplimiento" className="lp-card scroll-mt-24 p-6 sm:p-7 lg:col-span-12">
              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div>
                  <span className="lp-chip"><LuShieldCheck size={13} /> Cumplimiento</span>
                  <h3 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Listo para el registro electrónico de 2027
                  </h3>
                  <p className="lp-muted mt-2 text-[14px] leading-relaxed">
                    La reforma a la LFT obliga a registrar electrónicamente inicio y fin de jornada de todos los
                    trabajadores. TimeManager cubre el flujo completo y deja el rastro auditable; la NOM-037 de
                    teletrabajo se atiende con políticas, consentimiento y control de desconexión.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="lp-chip"><LuFileText size={13} /> Export con hash</span>
                    <span className="lp-chip"><LuBell size={13} /> Alertas de jornada</span>
                    <span className="lp-chip"><LuMapPin size={13} /> GPS solo al marcar</span>
                  </div>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {NOM_CHECKS.map((item) => (
                    <li key={item} className="lp-card-soft flex items-start gap-2.5 p-3.5 text-[12.5px] leading-snug">
                      <LuCheck size={15} className="mt-0.5 shrink-0" style={{ color: "var(--lp-accent-ink)" }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </div>
        </section>

        {/* ── Galería ─────────────────────────────────────────── */}
        <section className="border-y" style={{ borderColor: "var(--lp-line)", backgroundColor: "var(--lp-surface-2)" }}>
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <SectionTitle eyebrow="Así se ve" title="Capturas reales del sistema" text="Sin mockups: pantallas del producto con datos de prueba." />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <div data-reveal>
                <BrowserFrame className="lp-shot" src="/landing/clock-dashboard.jpg" alt="Dashboard del reloj" url="acme.timemanager.mx/#/time-clocks/dashboard" />
              </div>
              <div data-reveal>
                <BrowserFrame className="lp-shot" src="/landing/time-clocks.jpg" alt="Configuración de relojes" url="acme.timemanager.mx/#/time-clocks" />
              </div>
              <div data-reveal>
                <BrowserFrame className="lp-shot" src="/landing/portal.jpg" alt="Portal del trabajador" url="acme.timemanager.mx/#/mi-jornada" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Agente ──────────────────────────────────────────── */}
        <section id="reloj" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28">
          <SectionTitle
            eyebrow="TimeManagerAgent"
            title="El brazo de TimeManager en la red del cliente"
            text="Una app de escritorio con nuestra interfaz: conecta el reloj, sincroniza las checadas y ejecuta las altas del padrón."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: LuLaptop,
                step: "01",
                title: "Instala el agente",
                text: "Una PC del cliente con Windows o Linux. Se conecta con su credencial de dispositivo, sin VPN ni puertos abiertos.",
              },
              {
                icon: LuServer,
                step: "02",
                title: "Lee el reloj",
                text: "Habla con el Hikvision por la red local, lee las checadas por cursor y guarda una cola local si no hay internet.",
              },
              {
                icon: LuWifiOff,
                step: "03",
                title: "Sincroniza en bloques",
                text: "Sube las checadas cada 15–30 segundos (configurable), de forma idempotente, y ejecuta las altas/bajas que se piden desde la consola.",
              },
            ].map(({ icon: Icon, step, title, text }) => (
              <article key={step} data-reveal className="lp-card p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--lp-glow)", color: "var(--lp-accent-ink)" }}>
                    <Icon size={18} />
                  </span>
                  <span className="text-2xl font-black tracking-tight" style={{ color: "var(--lp-line-strong)" }}>{step}</span>
                </div>
                <h3 className="mt-4 text-base font-extrabold">{title}</h3>
                <p className="lp-muted mt-1.5 text-[13px] leading-relaxed">{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Planes ──────────────────────────────────────────── */}
        <section id="planes" className="scroll-mt-24 border-y" style={{ borderColor: "var(--lp-line)", backgroundColor: "var(--lp-surface-2)" }}>
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <SectionTitle
              eyebrow="Planes"
              title="Precios simples por tamaño de empresa"
              text="Elige por número de personas activas y relojes. Los límites se aplican solos y puedes cambiar de plan sin perder datos."
            />
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <article
                  key={plan.name}
                  data-reveal
                  className={`lp-card relative flex flex-col p-7 ${plan.highlight ? "ring-2 pt-9" : ""}`}
                  style={plan.highlight ? { boxShadow: "var(--lp-shadow)", borderColor: "var(--lp-accent)" } : undefined}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider" style={{ background: "var(--lp-accent)", color: "#2a1a00" }}>
                      Más elegido
                    </span>
                  )}
                  <h3 className="text-lg font-extrabold">{plan.name}</h3>
                  <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--lp-accent-ink)" }}>{plan.price}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="lp-chip"><LuUsers size={12} /> {plan.people}</span>
                    <span className="lp-chip"><LuClock size={12} /> {plan.clocks}</span>
                  </div>
                  <ul className="mt-5 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[13px]">
                        <LuCheck size={15} className="mt-0.5 shrink-0" style={{ color: "var(--lp-accent-ink)" }} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={DEMO_URL} className={`mt-6 ${plan.highlight ? "lp-btn-primary" : "lp-btn-ghost"} w-full`}>
                    Solicitar demo
                  </a>
                </article>
              ))}
            </div>
            <p className="lp-muted mt-6 text-center text-[12px]">
              Precios de referencia. El catálogo de planes es configurable por cliente desde la consola.
            </p>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28">
          <SectionTitle eyebrow="Preguntas frecuentes" title="Lo que suelen preguntarnos" />
          <div className="mt-10 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} data-reveal className="lp-card group p-5">
                <summary className="flex items-center justify-between gap-4 text-[14px] font-bold">
                  {item.q}
                  <LuChevronDown size={16} className="shrink-0" style={{ color: "var(--lp-muted)" }} />
                </summary>
                <p className="lp-muted mt-3 text-[13px] leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA final ───────────────────────────────────────── */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="lp-card lp-brand-card relative isolate mx-auto max-w-5xl overflow-hidden p-8 text-center sm:p-14" data-reveal>
            <div className="lp-cta-glow" aria-hidden="true" />
            <svg viewBox="16 16 88 88" className="lp-cta-mark" aria-hidden="true">
              <path d="M75.96 29.98 A34 34 0 1 1 44.04 29.98" fill="none" stroke="#F4F6FA" strokeWidth="8" strokeLinecap="round" />
              <path d="M38 30 H82" stroke="#F2A93B" strokeWidth="8" strokeLinecap="round" />
              <path d="M60 30 V60" stroke="#F2A93B" strokeWidth="8" strokeLinecap="round" />
              <path d="M60 60 L77 70" stroke="#F4F6FA" strokeWidth="6" strokeLinecap="round" />
              <circle cx="60" cy="60" r="5" fill="#F2A93B" />
            </svg>
            <span className="lp-chip">
              <LuSparkles size={13} /> Empieza hoy
            </span>
            <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Llega a 2027 con el registro de jornada listo
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed">
              Te mostramos el sistema con tus pantallas y tus planes. Instalamos el reloj, el agente y dejamos a tu
              personal operando en días, no meses.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={DEMO_URL} className="lp-btn-primary" style={{ background: "var(--lp-accent)", color: "#2a1a00" }}>
                Solicitar demo
                <LuArrowRight size={16} />
              </a>
              <Link to="/login" className="lp-btn-ghost">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="border-t" style={{ borderColor: "var(--lp-line)" }}>
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--lp-navy)" }}>
                <LuClock size={16} style={{ color: "var(--lp-accent)" }} />
              </span>
              <span className="text-[13px] font-extrabold">
                Time<span className="lp-accent">Manager</span>
              </span>
            </div>
            <p className="lp-muted text-[11.5px]">
              Registro de jornada y checadas multi-cliente · Hecho por AXZY
            </p>
            <div className="lp-muted flex gap-4 text-[12px] font-semibold">
              <a href="#cumplimiento">Cumplimiento</a>
              <a href="#planes">Planes</a>
              <Link to="/login">Iniciar sesión</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

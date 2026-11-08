import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  LuArrowRight,
  LuBriefcase,
  LuCalendarCheck,
  LuCalendarClock,
  LuCheck,
  LuFileLock2,
  LuFingerprint,
  LuFolderOpen,
  LuHouse,
  LuLayers,
  LuMapPin,
  LuMenu,
  LuPlane,
  LuScale,
  LuServer,
  LuShieldCheck,
  LuSmartphone,
  LuTimer,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { AgentVisual, CellHead, ReformVisual } from "./ui/BentoCells";
import { Shot, ShotWindow, type ShotName } from "./ui/Shot";
import { useLandingSeo } from "./useLandingSeo";
import "./landing.css";

/** Las demos se piden por WhatsApp (+52 1 55 3045 1099). */
const DEMO_URL =
  "https://wa.me/525530451099?text=" +
  encodeURIComponent("Hola, quiero una demo de CheckLab. Mi empresa es ___ y tenemos aprox. ___ personas.");
const DEMO_LINK = { href: DEMO_URL, target: "_blank", rel: "noopener noreferrer" } as const;

const NAV = [
  { id: "producto", label: "Producto" },
  { id: "modulos", label: "Módulos" },
  { id: "cumplimiento", label: "Cumplimiento" },
  { id: "planes", label: "Planes" },
  { id: "faq", label: "Preguntas" },
];

const FACTS = [
  { value: "0", label: "checadas editables", sub: "se corrigen con ajuste aprobado" },
  { value: "2", label: "formas de checar", sub: "reloj físico o web con ubicación" },
  { value: "12 h", label: "tope diario vigilado", sub: "con alerta a RH" },
  { value: "48→40 h", label: "transición LFT", sub: "aplicada semana a semana" },
];

type Chapter = {
  icon: IconType;
  label: string;
  title: string;
  text: string;
  points: string[];
  shot: ShotName;
  path: string;
  alt: string;
};

const CHAPTERS: Chapter[] = [
  {
    icon: LuMapPin,
    label: "Checar",
    title: "Con reloj o desde el teléfono, con el punto en el mapa",
    text: "¿No quieres comprar reloj? Tu equipo checa desde la web: entrada, salida a comer, regreso y salida. La ubicación se toma solo en el momento del marcaje.",
    points: ["Latitud, longitud y precisión por marcaje", "Sin rastreo continuo", "Cuenta para asistencia y pre-nómina, igual que el reloj"],
    shot: "landing-map-cut",
    path: "/mi-jornada",
    alt: "Mapa con la ubicación de la última checada web de una persona",
  },
  {
    icon: LuCalendarCheck,
    label: "Ver el día",
    title: "La semana de cada persona, en una rejilla",
    text: "Quién llegó a tiempo, quién con retardo y quién no ha llegado. Las checadas del reloj y las de la web se ven juntas, día por día.",
    points: ["Retardos y faltas contra el horario", "Filtros por departamento", "Export de la semana"],
    shot: "attendance-week",
    path: "/hr/time-clock/entries-exits",
    alt: "Rejilla semanal de asistencia con entradas, salidas y retardos",
  },
  {
    icon: LuTimer,
    label: "Horas extra LFT",
    title: "Dobles, triples y excedente ilegal, ya clasificados",
    text: "Cada semana se compara contra el horario y se separa con las reglas de la LFT. RH confirma la semana y la nómina recibe cifras cerradas.",
    points: ["Tope al doble del año en curso", "Triples y excedente marcados", "Confirmación semanal por persona"],
    shot: "overtime-lft",
    path: "/schedules/overtime/approval",
    alt: "Tabla de horas extra por semana con horas dobles, triples y excedente",
  },
  {
    icon: LuBriefcase,
    label: "Pre-nómina",
    title: "Revisa por departamento y cierra la semana",
    text: "Costo de la plantilla, sueldo diario de cada persona y horas extra en una sola vista. Al cerrar se guarda una fotografía de las cifras; si hace falta, se reabre con registro.",
    points: ["Revisión por departamento", "Cierre con snapshot", "Historial de cierres y reaperturas"],
    shot: "payroll",
    path: "/schedules/payroll",
    alt: "Pre-nómina con indicadores de horas, costo de plantilla y revisión por departamento",
  },
  {
    icon: LuFileLock2,
    label: "Prueba ante la autoridad",
    title: "Convenios, método de registro y nada que se borre",
    text: "Convenios del art. 58, acuerdo del método de registro y constancia semanal. La checada original nunca cambia: cada corrección lleva motivo y aprobador.",
    points: ["Convenios de distribución de jornada", "Acuerdo del método de registro", "Bitácora inmutable y export con hash"],
    shot: "agreements",
    path: "/hr/jornada-acuerdos",
    alt: "Pantalla de convenios y acuerdos del método de registro",
  },
];

const COMPLIANCE = [
  "Inicio y fin de jornada de todas las modalidades: reloj, web y teletrabajo",
  "Ubicación por marcaje, opcional y sin rastreo continuo",
  "Checadas inmutables; cada corrección con motivo y aprobador distinto",
  "Horas extra al doble y al triple con los topes de los arts. 66 y 68",
  "Acuerdo del método de registro y constancia semanal del trabajador",
  "Convenios de distribución de jornada para turnos nocturnos",
  "Teletrabajo NOM-037: política, consentimiento, checklist y desconexión",
  "Export de registros para la autoridad con hash de integridad",
];

const STEPS = [
  {
    icon: LuFingerprint,
    title: "Elige cómo checar",
    text: "Reloj Hikvision con el agente en tu red, checada web desde el teléfono o las dos. Todo llega al mismo registro.",
  },
  {
    icon: LuCalendarClock,
    title: "Configura tu operación",
    text: "Importa a tu personal, arma horarios de 7 días con descansos y turnos nocturnos, y define puestos y salarios.",
  },
  {
    icon: LuShieldCheck,
    title: "RH opera la semana",
    text: "Revisa asistencia, confirma horas extra y cierra la pre-nómina. CheckLab deja la prueba de cada paso.",
  },
];

const PLANS = [
  {
    id: "basico",
    name: "Básico",
    range: "1–10 personas",
    price: "69",
    example: "10 personas = $690 + IVA",
    tagline: "Para empezar a ordenar la asistencia sin comprar reloj.",
    features: ["Checada web con ubicación", "Horarios de 7 días", "Asistencia y retardos", "Portal Mi jornada", "Reportes y export"],
    highlight: false,
  },
  {
    id: "profesional",
    name: "Profesional",
    range: "11–49 personas",
    price: "59",
    example: "20 personas = $1,180 + IVA",
    tagline: "El paquete completo de RH, horas extra y pre-nómina.",
    features: ["Todo lo del Básico", "Reloj físico integrado", "Horas extra LFT dobles/triples", "Pre-nómina y cierres", "Expedientes y documentos", "Teletrabajo NOM-037"],
    highlight: true,
  },
  {
    id: "empresa",
    name: "Empresa",
    range: "50+ personas",
    price: "49",
    example: "50 personas = $2,450 + IVA",
    tagline: "Para operaciones con varios relojes y equipos de RH.",
    features: ["Todo lo del Profesional", "Varios relojes conectados", "Roles y auditoría avanzada", "API e integraciones", "Onboarding y soporte prioritario"],
    highlight: false,
  },
];

/** Filas de la tabla comparativa. `true` = incluido; texto = límite/nota. */
const COMPARISON: Array<{ label: string; values: [boolean | string, boolean | string, boolean | string] }> = [
  { label: "Checada web con GPS y mapa", values: [true, true, true] },
  { label: "Checada con reloj físico", values: [false, true, true] },
  { label: "Horarios, descansos y turnos nocturnos", values: [true, true, true] },
  { label: "Asistencia, retardos y faltas", values: [true, true, true] },
  { label: "Portal Mi jornada", values: [true, true, true] },
  { label: "Horas extra LFT (dobles/triples/excedente)", values: [true, true, true] },
  { label: "Pre-nómina, costo y cierre semanal", values: [false, true, true] },
  { label: "Expedientes y documentos", values: [false, true, true] },
  { label: "Vacaciones, permisos y convenios", values: [false, true, true] },
  { label: "Teletrabajo y checklists NOM-037", values: [false, true, true] },
  { label: "Roles, permisos y auditoría", values: ["1 admin", "Hasta 3 admin", "Ilimitados"] },
  { label: "Relojes conectados", values: ["—", "Hasta 3", "Sin límite"] },
  { label: "API e integraciones", values: [false, false, true] },
  { label: "Soporte", values: ["Correo", "Prioritario", "Dedicado + onboarding"] },
];

const FAQ = [
  {
    q: "¿CheckLab cumple con el registro electrónico de jornada?",
    a: "Registra inicio y fin de jornada de todas las modalidades (reloj, web y teletrabajo), guarda las checadas de forma inmutable, documenta cada corrección con su aprobador y genera el export de registros con hash. El formato oficial y la retención definitiva dependen de las disposiciones que publique la STPS; el sistema está hecho para ajustarse a ellas.",
  },
  {
    q: "¿Necesito comprar un reloj checador?",
    a: "No. Puedes operar solo con la checada web: cada persona marca entrada, salida a comer, regreso y salida desde su teléfono o computadora, y esas checadas cuentan para asistencia y pre-nómina igual que las del reloj. Si prefieres reloj, instalamos uno por sitio.",
  },
  {
    q: "¿Sirve para home office y personal en campo?",
    a: "Sí. En Mi jornada cada persona tiene su checada, su teletrabajo, su registro y horas extra, y sus vacaciones y permisos. Puede compartir su ubicación solo en el momento de marcar: no hay rastreo continuo.",
  },
  {
    q: "¿Cómo calcula las horas extra?",
    a: "Compara lo trabajado contra el horario de cada persona y clasifica la semana con las reglas de la LFT: horas al doble hasta el tope del año, excedente al triple y lo que rebasa la ley marcado aparte. Cuando la jornada ordinaria baje rumbo a 40 horas, el tope se aplica según el año de cada semana.",
  },
  {
    q: "¿Cómo se conecta el reloj checador?",
    a: "El CheckLab Agent (app de escritorio) se conecta al reloj por tu red local, lee las checadas y las envía al sistema. No necesitas abrir puertos ni contratar VPN, y si se cae el internet las checadas esperan en una cola local sin duplicarse.",
  },
  {
    q: "¿Cómo se cobran los planes?",
    a: "Por persona activa al mes, más IVA: $69 en el plan Básico (1–10 personas), $59 en Profesional (11–49) y $49 en Empresa (50 o más). Si tienes entre 11 y 19 personas se factura como Profesional. Dar de baja a alguien libera su lugar en el siguiente corte.",
  },
];

const Logo = ({ className = "h-8" }: { className?: string }) => (
  <img src="/brand/svg/checklab-logo-for-light-bg.svg" alt="CheckLab" width={150} height={32} className={`w-auto ${className}`} />
);

const SectionHead = ({ id, eyebrow, title, text }: { id?: string; eyebrow: string; title: string; text?: string }) => (
  <div id={id} className="mx-auto max-w-[720px] scroll-mt-24 text-center" data-reveal>
    <span className="cl-eyebrow">{eyebrow}</span>
    <h2 className="cl-h2 mt-3 text-balance">{title}</h2>
    {text && <p className="cl-muted mx-auto mt-4 max-w-[580px] text-pretty text-[16px] leading-relaxed">{text}</p>}
  </div>
);

const Check = ({ children }: { children: ReactNode }) => (
  <li className="flex items-start gap-2.5 text-[14px] leading-snug">
    <LuCheck size={16} className="cl-mint mt-0.5 shrink-0" strokeWidth={3} />
    <span>{children}</span>
  </li>
);

/** Celda del bento con encabezado y captura recortada. */
const ShotCell = ({
  span,
  icon,
  label,
  title,
  text,
  shot,
  alt,
  crop = "16 / 10",
}: {
  span: string;
  icon: IconType;
  label: string;
  title: string;
  text: string;
  shot: ShotName;
  alt: string;
  crop?: string;
}) => (
  <article data-reveal className={`cl-card flex flex-col gap-6 p-6 sm:p-7 ${span}`}>
    <CellHead icon={icon} label={label} title={title} text={text} />
    <div className="cl-shot-frame mt-auto">
      <Shot name={shot} alt={alt} crop={crop} sizes="(min-width: 1024px) 680px, (min-width: 768px) 50vw, 100vw" />
    </div>
  </article>
);

/** Spotlight del bento: el halo sigue al puntero dentro de cada tarjeta. */
const trackPointer = (event: PointerEvent<HTMLDivElement>) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>(".cl-card");
  if (!card || card.parentElement !== event.currentTarget) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  card.style.setProperty("--my", `${event.clientY - rect.top}px`);
};

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useLandingSeo();

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
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    nodes.forEach((node, index) => {
      node.style.transitionDelay = `${(index % 4) * 60}ms`;
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} className="cl-landing relative min-h-screen antialiased">
      <div className="cl-backdrop" aria-hidden="true" />

      {/* ── Navegación ───────────────────────────────────────── */}
      <header className="cl-header sticky top-0 z-50 border-b">
        <div className="cl-wrap flex items-center justify-between gap-4 py-3">
          <a href="#top" aria-label="CheckLab, inicio">
            <Logo className="h-8" />
          </a>
          <nav className="hidden items-center gap-7 text-[14px] font-semibold md:flex" aria-label="Secciones">
            {NAV.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="cl-link">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="cl-link hidden px-2 text-[14px] font-semibold sm:block">
              Iniciar sesión
            </Link>
            <span className="hidden sm:block">
              <a {...DEMO_LINK} className="cl-btn cl-btn-primary !px-4 !py-2.5 !text-[14px]">
                Solicitar demo
              </a>
            </span>
            <span className="md:hidden">
              <button
                type="button"
                className="cl-icon-btn"
                onClick={() => setMenuOpen((value) => !value)}
                aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <LuX size={18} /> : <LuMenu size={18} />}
              </button>
            </span>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t px-4 py-4 md:hidden" style={{ borderColor: "var(--line)", background: "var(--bg)" }} aria-label="Secciones (menú)">
            <div className="grid gap-3 text-[15px] font-semibold">
              {NAV.map((item) => (
                <a key={item.id} href={`#${item.id}`} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to="/login" className="cl-btn cl-btn-ghost">
                  Iniciar sesión
                </Link>
                <a {...DEMO_LINK} className="cl-btn cl-btn-primary">
                  Solicitar demo
                </a>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section id="top" className="cl-wrap relative grid gap-14 pb-16 pt-12 sm:pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12 lg:pb-24 lg:pt-20">
          <div className="cl-hero-glow" aria-hidden="true" />
          <div data-reveal>
            <span className="cl-chip">
              <span className="cl-pulse" /> Reloj checador o checada web con ubicación
            </span>
            <h1 className="cl-h1 mt-6 text-balance">
              Cada checada cuenta. <span className="cl-mint">Y se puede comprobar.</span>
            </h1>
            <p className="cl-muted mt-6 max-w-[560px] text-pretty text-[17px] leading-relaxed sm:text-[18px]">
              Asistencia, horas extra con la LFT y pre-nómina en un solo registro de jornada. Tu equipo checa con el reloj
              o desde el teléfono, y RH cierra la semana con la prueba que pide la ley.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a {...DEMO_LINK} className="cl-btn cl-btn-primary">
                Solicitar demo <LuArrowRight size={17} />
              </a>
              <a href="#producto" className="cl-btn cl-btn-ghost">
                Ver el producto
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-semibold">
              {["Sin reloj obligatorio", "Datos aislados por empresa", "Soporte en español"].map((item) => (
                <li key={item} className="cl-muted flex items-center gap-1.5">
                  <LuCheck size={16} className="cl-mint" strokeWidth={3} /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal className="cl-hero-stage">
            <ShotWindow path="/" className="cl-hero-window">
              <Shot
                name="hero-home"
                alt="Inicio de CheckLab con personas en sitio, retardos, expedientes y horas extra de la semana"
                sizes="(min-width: 1024px) 640px, 86vw"
                eager
              />
            </ShotWindow>
            <div className="cl-phone cl-hero-phone">
              <Shot name="hero-mobile-jornada" alt="Mi jornada en el teléfono con la entrada registrada" eager />
            </div>
            <div className="cl-float-card cl-float" aria-hidden="true">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--mint-soft)", color: "var(--mint)" }}>
                <LuMapPin size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-extrabold leading-tight">Checada web registrada</p>
                <p className="cl-muted text-[12.5px] leading-tight">Entrada · 12:02 · ubicación ±18 m</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Cifras ───────────────────────────────────────────── */}
        <section className="cl-wrap">
          <div className="cl-facts grid grid-cols-2 overflow-hidden rounded-[24px] border lg:grid-cols-4">
            {FACTS.map((fact) => (
              <div key={fact.label} data-reveal className="px-5 py-6 sm:px-7">
                <p className="text-[32px] font-black leading-none tracking-tight sm:text-[38px]">{fact.value}</p>
                <p className="mt-2 text-[14px] font-bold">{fact.label}</p>
                <p className="cl-faint text-[13px]">{fact.sub}</p>
              </div>
            ))}
          </div>
          <div className="cl-ticker" aria-hidden="true">
            <div className="cl-ticker-track">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 items-center gap-8 pr-8">
                  {["Checada web con GPS", "Reloj físico o sin reloj", "Horas extra LFT", "NOM-037 teletrabajo", "Pre-nómina con cierre", "Registro inmutable", "Multi-cliente"].map((item) => (
                    <span key={`${copy}-${item}`}>{item}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Recorrido ────────────────────────────────────────── */}
        <section className="cl-wrap py-24 lg:py-32">
          <SectionHead
            id="producto"
            eyebrow="Producto"
            title="De la checada al cierre de nómina, sin hojas de cálculo"
            text="Un solo flujo: tu gente checa, RH ve el día, las horas extra salen con la ley y la pre-nómina se cierra con prueba."
          />
          <ol className="mt-14 grid gap-5">
            {CHAPTERS.map((chapter, index) => (
              <li key={chapter.label} data-reveal className="cl-card grid gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:items-center lg:gap-10">
                <div className={`lg:col-span-5 ${index % 2 ? "lg:order-2" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="cl-step-num">0{index + 1}</span>
                    <span className="cl-eyebrow">
                      <chapter.icon size={14} /> {chapter.label}
                    </span>
                  </div>
                  <h3 className="cl-h3 cl-h3-lg mt-4 text-balance">{chapter.title}</h3>
                  <p className="cl-muted mt-3 text-pretty text-[15px] leading-relaxed">{chapter.text}</p>
                  <ul className="mt-5 space-y-2.5">
                    {chapter.points.map((point) => (
                      <Check key={point}>{point}</Check>
                    ))}
                  </ul>
                </div>
                <div className="lg:col-span-7">
                  <ShotWindow path={chapter.path}>
                    <Shot name={chapter.shot} alt={chapter.alt} />
                  </ShotWindow>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Bento de módulos ─────────────────────────────────── */}
        <section className="cl-wrap pb-24 lg:pb-32">
          <SectionHead
            id="modulos"
            eyebrow="Módulos"
            title="Todo lo que RH opera cada semana"
            text="Pantallas reales del producto con datos de demostración."
          />

          <div className="cl-bento mt-14 grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12" onPointerMove={trackPointer}>
            <ShotCell
              span="md:col-span-6 lg:col-span-7"
              icon={LuSmartphone}
              label="Mi jornada"
              title="El portal de cada persona, ordenado por tabs"
              text="Mi checada, Teletrabajo, Registro y horas extra, y Vacaciones y permisos. Con el mapa de su última checada web."
              shot="mi-jornada-map"
              alt="Mi jornada con las cuatro checadas del día, el siguiente paso y el mapa de ubicación"
            />
            <article data-reveal className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-6 lg:col-span-5">
              <CellHead
                icon={LuServer}
                label="Reloj y agente local"
                title="Tu reloj, conectado sin tocar la red"
                text="El agente habla con el reloj por la red local y sube las checadas a la nube. Alta y baja del personal en el reloj desde CheckLab."
              />
              <div className="mt-auto">
                <AgentVisual />
              </div>
            </article>

            <ShotCell
              span="md:col-span-6 lg:col-span-8"
              icon={LuFingerprint}
              label="Relojes"
              title="Estado en línea, alertas y padrón de cada reloj"
              text="Tabs de estado, personas, eventos, cámara, lector y relojes. Vincula cada reloj con su persona y detecta a quien dejó de checar."
              shot="clock-dashboard"
              alt="Dashboard del reloj con estado en línea, personas, eventos y alertas"
            />
            <article
              data-reveal
              className="cl-card flex flex-col gap-6 p-6 sm:p-7 md:col-span-6 lg:col-span-4"
              style={{ background: "linear-gradient(160deg, var(--surface) 55%, var(--mint-soft))" }}
            >
              <CellHead
                icon={LuScale}
                label="Reforma laboral"
                title="De 48 a 40 horas, año por año"
                text="La jornada ordinaria baja dos horas por año desde 2027. CheckLab aplica el límite que corresponde a cada semana."
              />
              <div className="my-auto">
                <ReformVisual />
              </div>
            </article>

            <ShotCell
              span="md:col-span-3 lg:col-span-6"
              icon={LuCalendarClock}
              label="Horarios"
              title="Semana de 7 días, descansos y turnos nocturnos"
              text="Validación legal al guardar y aviso antes de reemplazar un horario en uso."
              shot="schedules"
              alt="Lista de horarios con los días de la semana y horas por jornada"
            />
            <ShotCell
              span="md:col-span-3 lg:col-span-6"
              icon={LuUsers}
              label="Asignación"
              title="Asigna horarios en dos columnas"
              text="Pasa personas de un lado a otro con flechas. Cada persona tiene una sola asignación vigente."
              shot="schedule-assign"
              alt="Asignación de horario con personas sin horario y con horario en dos columnas"
            />

            <ShotCell
              span="md:col-span-3 lg:col-span-4"
              icon={LuHouse}
              label="Teletrabajo NOM-037"
              title="Teletrabajo en regla"
              text="Política con consentimiento, checklists del lugar y desconexión digital."
              shot="telework"
              alt="Teletrabajo con política, teletrabajadores, checklists y comunicaciones"
            />
            <ShotCell
              span="md:col-span-3 lg:col-span-4"
              icon={LuFolderOpen}
              label="Expedientes"
              title="Documentos completos y faltantes a la vista"
              text="Catálogo de documentos obligatorios y avance por persona."
              shot="employee-records"
              alt="Expedientes de empleados con documentos obligatorios y faltantes"
            />
            <ShotCell
              span="md:col-span-6 lg:col-span-4"
              icon={LuPlane}
              label="Vacaciones y permisos"
              title="Una bandeja para aprobar"
              text="Solicitudes del portal, saldos e historial por persona."
              shot="leave"
              alt="Bandeja de vacaciones y permisos pendientes de aprobar"
            />

            <ShotCell
              span="md:col-span-6 lg:col-span-7"
              icon={LuBriefcase}
              label="Puestos de nómina"
              title="Puestos, salarios y sueldo diario"
              text="El salario de cada puesto alimenta el costo de la plantilla en la pre-nómina."
              shot="payroll-settings"
              alt="Puestos de nómina con salario diario, salario base y personal asignado"
            />
            <article data-reveal className="cl-card flex flex-col gap-5 p-6 sm:p-7 md:col-span-6 lg:col-span-5">
              <CellHead
                icon={LuLayers}
                label="Control y multi-empresa"
                title="Cada quien ve lo que le toca"
                text="Roles y permisos por pantalla, bitácora que no se puede editar y una consola para operar varias empresas clientes."
              />
              <ul className="mt-auto grid gap-2.5">
                {[
                  ["Roles y permisos", "Administrador, RH y personal, o roles a tu medida"],
                  ["Auditoría inmutable", "Quién hizo qué y cuándo, sin poder borrarlo"],
                  ["Consola multi-cliente", "Subdominio, plan y límites por empresa; datos aislados"],
                ].map(([title, sub]) => (
                  <li key={title} className="cl-panel flex items-start gap-3 px-4 py-3">
                    <LuCheck size={16} className="cl-mint mt-0.5 shrink-0" strokeWidth={3} />
                    <span>
                      <span className="block text-[14px] font-bold">{title}</span>
                      <span className="cl-faint block text-[13px] leading-snug">{sub}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {/* ── Cumplimiento ─────────────────────────────────────── */}
        <section id="cumplimiento" className="cl-wrap scroll-mt-20">
          <div data-reveal className="cl-navy overflow-hidden rounded-[32px] p-7 sm:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <span className="cl-eyebrow" style={{ color: "#34D399" }}>
                  Cumplimiento
                </span>
                <h2 className="cl-h2 mt-3 text-balance">El registro electrónico que la ley ya pide</h2>
                <p className="mt-4 text-[16px] leading-relaxed" style={{ color: "rgba(244,246,250,0.78)" }}>
                  La reforma a la Ley Federal del Trabajo obliga a registrar electrónicamente el inicio y fin de la jornada de
                  cada trabajador. CheckLab cubre el flujo completo y deja el rastro auditable.
                </p>
                <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "rgba(244,246,250,0.68)" }}>
                  El formato oficial y la retención definitiva dependen de las disposiciones que publique la STPS. Validamos
                  cada ajuste contigo antes de aplicarlo.
                </p>
              </div>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {COMPLIANCE.map((item) => (
                  <li key={item} className="cl-navy-item flex items-start gap-3 rounded-2xl px-4 py-3.5 text-[14px] leading-snug">
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
        <section className="cl-wrap py-24 lg:py-32">
          <SectionHead id="como-funciona" eyebrow="Cómo funciona" title="Operando en días, no en meses" text="Nos encargamos de la instalación; tu equipo solo aprende a revisar y aprobar." />
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} data-reveal className="cl-card p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "var(--mint-soft)", color: "var(--mint)" }}>
                    <Icon size={20} />
                  </span>
                  <span className="cl-step-num !text-[40px]">0{index + 1}</span>
                </div>
                <h3 className="cl-h3 mt-5">{title}</h3>
                <p className="cl-muted mt-2 text-[15px] leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Planes ───────────────────────────────────────────── */}
        <section id="planes" className="scroll-mt-20 border-y" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
          <div className="cl-wrap py-24 lg:py-28">
            <SectionHead
              eyebrow="Precios"
              title="Paga por persona. Sin reloj obligatorio."
              text="Los tres planes incluyen checada web con ubicación. El precio baja conforme crece tu equipo y todos se facturan por persona activa al mes, más IVA."
            />

            <div className="mt-14 grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <article
                  key={plan.id}
                  data-reveal
                  className={`cl-card cl-plan-card flex flex-col p-7 ${plan.highlight ? "cl-plan-card--featured" : ""}`}
                >
                  {plan.highlight && (
                    <span className="cl-plan-shine" aria-hidden="true" />
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="cl-h3">{plan.name}</h3>
                      <span className="cl-chip mt-2 inline-flex">
                        <LuUsers size={13} /> {plan.range}
                      </span>
                    </div>
                    {plan.highlight && <span className="cl-tag cl-tag-mint">Más elegido</span>}
                  </div>

                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="cl-plan-price text-[44px] font-black leading-none tracking-tight">${plan.price}</span>
                    <span className="cl-muted text-[13px] font-semibold">MXN / persona / mes</span>
                  </p>
                  <p className="cl-faint mt-1 text-[12.5px] font-semibold">+ IVA · {plan.example}</p>
                  <p className="cl-muted mt-4 text-[14px] leading-relaxed">{plan.tagline}</p>

                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((feature) => (
                      <Check key={feature}>{feature}</Check>
                    ))}
                  </ul>
                  <a {...DEMO_LINK} className={`cl-btn mt-8 w-full ${plan.highlight ? "cl-btn-primary" : "cl-btn-ghost"}`}>
                    Solicitar demo <LuArrowRight size={16} />
                  </a>
                </article>
              ))}
            </div>

            <div data-reveal className="mt-10 overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              <div className="flex flex-col gap-2 border-b px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="cl-eyebrow">Comparativa</p>
                  <h3 className="cl-h3 mt-1">Qué incluye cada plan</h3>
                </div>
                <p className="cl-muted text-[12.5px]">Precio por persona activa · + IVA</p>
              </div>
              <div className="cl-compare-wrap">
                <table className="cl-compare">
                  <thead>
                    <tr>
                      <th scope="col" className="cl-compare-feature">Función</th>
                      {PLANS.map((plan) => (
                        <th key={plan.id} scope="col" className={plan.highlight ? "cl-compare-highlight" : ""}>
                          <span className="block text-[14px] font-extrabold">{plan.name}</span>
                          <span className="cl-muted block text-[11.5px] font-semibold">${plan.price}/persona</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        {row.values.map((value, index) => (
                          <td key={index} className={PLANS[index].highlight ? "cl-compare-highlight" : ""}>
                            {typeof value === "boolean" ? (
                              value ? (
                                <LuCheck size={17} className="cl-mint mx-auto" strokeWidth={3} aria-label="Incluido" />
                              ) : (
                                <LuX size={16} className="cl-compare-no mx-auto" aria-label="No incluido" />
                              )
                            ) : (
                              <span className="cl-compare-note">{value}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
              <p className="cl-muted text-[13px]">
                Precio por persona activa al mes, más IVA. Sin costo de instalación. Si tienes entre 11 y 19 personas, se factura como Profesional.
              </p>
              <a {...DEMO_LINK} className="cl-btn cl-btn-primary shrink-0">
                Cotizar mi equipo <LuArrowRight size={16} />
              </a>
            </div>
          </div>
        </section>

        {/* ── Preguntas ────────────────────────────────────────── */}
        <section className="mx-auto max-w-[820px] px-4 py-24 sm:px-6 lg:py-28">
          <SectionHead id="faq" eyebrow="Preguntas frecuentes" title="Lo que suelen preguntarnos" />
          <div className="mt-12 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} data-reveal className="cl-card cl-faq !rounded-[20px] px-5 py-4">
                <summary className="flex items-center justify-between gap-4 text-[15.5px] font-bold">
                  {item.q}
                  <span className="cl-faq-icon cl-muted shrink-0 text-[22px] leading-none" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="cl-muted mt-3 text-[15px] leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Llamado final ────────────────────────────────────── */}
        <section className="cl-wrap pb-24">
          <div data-reveal className="cl-navy relative overflow-hidden rounded-[32px] px-6 py-14 text-center sm:px-14 sm:py-20">
            <img src="/brand/svg/checklab-symbol-for-dark-bg.svg" alt="" aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 opacity-[0.07] sm:h-80 sm:w-80" />
            <h2 className="cl-h2 mx-auto max-w-[680px] text-balance">Llega a la reforma con el registro de jornada resuelto</h2>
            <p className="mx-auto mt-4 max-w-[580px] text-[16px] leading-relaxed" style={{ color: "rgba(244,246,250,0.78)" }}>
              Te mostramos CheckLab con una operación de turnos completa. Si te convence, arrancas con la checada web o
              instalamos el reloj, y tu equipo empieza a operar en días.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a {...DEMO_LINK} className="cl-btn cl-btn-amber">
                Solicitar demo <LuArrowRight size={17} />
              </a>
              <Link to="/login" className="cl-btn" style={{ border: "1px solid rgba(244,246,250,0.3)", color: "#F4F6FA" }}>
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t" style={{ borderColor: "var(--line)" }}>
        <div className="cl-wrap flex flex-col gap-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Logo className="h-7" />
          <p className="cl-muted text-[13px]">Registro de jornada, asistencia y pre-nómina · Hecho por AXZY</p>
          <div className="flex gap-5 text-[13.5px] font-semibold">
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

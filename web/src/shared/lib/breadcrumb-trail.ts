import { useEffect, useMemo } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Una página por la que pasó la persona: cómo se llama y cómo volver (con sus filtros). */
export interface TrailCrumb {
  label: string;
  path: string;
}

/** Página en pantalla: su ruta, cómo se nombra como migaja y la ruta con la que llegó. */
interface Visit {
  key: string;
  path: string;
  label: string;
  trail: TrailCrumb[];
}

/** Estado de navegación que entiende la memoria de migajas. */
export interface TrailState {
  /** Navegación desde el menú: empieza de cero con las migajas de la página. */
  menu?: boolean;
  /** Ruta explícita (al hacer clic en una migaja de la memoria). */
  trail?: TrailCrumb[];
}

const MAX_CRUMBS = 4;
const STORAGE_KEY = "tm.breadcrumbTrail";

/**
 * Ruta de migajas de la página nueva según cómo se llegó. Pura para probarla:
 * - menú o carga directa → `[]` (la página usa sus migajas de siempre);
 * - atrás/adelante → la que ya tenía esa entrada del historial;
 * - reemplazo → la de la página actual (es la misma pantalla);
 * - clic en una página → la de la anterior más la anterior. Si la ruta nueva ya
 *   estaba en la cadena, se corta ahí (subir no alarga la ruta).
 */
export const nextTrail = (input: {
  path: string;
  navigation: "PUSH" | "POP" | "REPLACE";
  state: TrailState | null | undefined;
  remembered: TrailCrumb[] | undefined;
  previous: Visit | null;
}): TrailCrumb[] => {
  const { path, navigation, state, remembered, previous } = input;
  if (state?.trail) return state.trail;
  if (state?.menu) return [];
  if (remembered) return remembered;
  if (!previous) return [];
  if (navigation === "REPLACE" || previous.path === path) return previous.trail;
  if (navigation !== "PUSH") return [];
  const chain = [...previous.trail, { label: previous.label, path: previous.path }];
  const pathOnly = (value: string) => value.split("?")[0];
  const seen = chain.findIndex((crumb) => pathOnly(crumb.path) === pathOnly(path));
  return (seen >= 0 ? chain.slice(0, seen) : chain).slice(-MAX_CRUMBS);
};

let current: Visit | null = null;

const loadRemembered = (): Record<string, TrailCrumb[]> => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, TrailCrumb[]>;
  } catch {
    return {};
  }
};

const remember = (key: string, trail: TrailCrumb[]) => {
  try {
    const all = loadRemembered();
    all[key] = trail;
    const keys = Object.keys(all);
    for (const old of keys.slice(0, Math.max(0, keys.length - 200))) delete all[old];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    return;
  }
};

/**
 * Memoria de migajas de la página: de qué páginas viene la persona. `label` es
 * cómo se nombra esta página cuando otra la muestre como migaja.
 */
export const useBreadcrumbTrail = (label: string): TrailCrumb[] => {
  const location = useLocation();
  const navigation = useNavigationType();
  const path = `${location.pathname}${location.search}`;

  const trail = useMemo(
    () =>
      nextTrail({
        path,
        navigation,
        state: location.state as TrailState | null,
        remembered: loadRemembered()[location.key],
        previous: current && current.key !== location.key ? current : null,
      }),
    // Solo cambia con la entrada del historial; el resto se lee en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.key]
  );

  useEffect(() => {
    remember(location.key, trail);
  }, [location.key, trail]);

  useEffect(() => {
    current = { key: location.key, path, label, trail };
  }, [location.key, path, label, trail]);

  return trail;
};

/**
 * Avisos internos de la app para cosas que pasan fuera de una pantalla.
 * Es deliberadamente mínimo (sin estado global): quien escucha no depende de
 * quién avisa, y el aviso viaja aunque la pantalla esté montada desde antes.
 */
export interface AppEventMap {
  /** El bot de Personal llena un campo del formulario en pantalla. */
  "employee:fill": { field: string; value: string };
  /** El bot terminó de llenar (para enfocar el primer campo o avisar). */
  "employee:fill-done": Record<string, never>;
  /** La pantalla guardó (o falló) el autoguardado que pidió el bot. */
  "employee:saved": { ok: boolean };
  /** Abre el panel con el formulario de edición de ese horario. */
  "schedule:edit": { id: string };
  /** El bot cambió un horario: la tabla recarga. */
  "schedule:updated": Record<string, never>;
  /** El bot dio de alta un horario: la tabla de Horarios recarga. */
  "schedule:created": Record<string, never>;
  /** El bot levantó un acta: la tabla de Reportes de personal recarga. */
  "disciplinary:created": Record<string, never>;
  /**
   * Tic pide a Entradas y salidas aplicar una vista rápida. La unión se
   * repite aquí (y no se importa de `entities/access`) porque `shared` no
   * depende de entidades; debe coincidir con `PeopleAttendanceView`.
   */
  "attendance:view": { view: "ALL" | "INCIDENTS" | "ON_SITE" | "WITHOUT_RECORDS" };
}

type Listener<K extends keyof AppEventMap> = (payload: AppEventMap[K]) => void;

const listeners = new Map<keyof AppEventMap, Set<Listener<never>>>();

/** Escucha un aviso. Devuelve la función para dejar de escuchar. */
export const onAppEvent = <K extends keyof AppEventMap>(name: K, listener: Listener<K>): (() => void) => {
  const set = listeners.get(name) ?? new Set();
  set.add(listener as Listener<never>);
  listeners.set(name, set);
  return () => {
    set.delete(listener as Listener<never>);
  };
};

/** Dispara un aviso a todo el que esté escuchando. */
export const emitAppEvent = <K extends keyof AppEventMap>(name: K, payload: AppEventMap[K]): void => {
  listeners.get(name)?.forEach((listener) => (listener as Listener<K>)(payload));
};

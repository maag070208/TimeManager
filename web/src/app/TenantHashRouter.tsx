import { useSyncExternalStore, type ReactNode } from "react";
import { HashRouter } from "react-router-dom";
import { tenantRouteBasename } from "@shared/api/tenant";

/**
 * `HashRouter` con la `basename` del cliente recalculada al cambiar el hash.
 * El listener se registra al importar este módulo (antes de montar el router),
 * para que el cambio de modo plataforma ↔ `/#/<slug>/…` se procese en el mismo
 * evento que el del histórico y el router no quede con el prefijo de arranque.
 */
let basename = tenantRouteBasename();
const listeners = new Set<() => void>();

const sync = (): void => {
  const next = tenantRouteBasename();
  if (next === basename) return;
  basename = next;
  for (const listener of listeners) listener();
};
window.addEventListener("hashchange", sync);
window.addEventListener("popstate", sync);

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): string => basename;

export default function TenantHashRouter({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  return <HashRouter basename={current}>{children}</HashRouter>;
}

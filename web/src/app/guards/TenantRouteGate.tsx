import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import type { RootState } from "@app/store";
import { tenantRouteFromLocation, tenantSlugFromHost } from "@shared/api/tenant";

/**
 * Mantiene la URL coherente con la sesión en el modo ruta por cliente:
 * - El personal de plataforma vive siempre sin prefijo (`/#/…`), nunca bajo la
 *   ruta de un cliente.
 * - Un usuario de cliente no opera bajo la ruta de otro cliente (el token manda).
 * - En local-first (`localhost:5006`), un cliente con sesión abierto en una URL
 *   sin prefijo se mueve a su ruta (`/#/acme/…`). En modo subdominio se conserva
 *   la URL sin prefijo de siempre.
 *
 * Solo cambia el hash: `TenantHashRouter` recalcula la `basename` y la vista se
 * rehace sin recargar.
 */
const goTo = (target: string): void => {
  window.location.hash = target;
};

export default function TenantRouteGate() {
  const { pathname, search } = useLocation();
  const user = useSelector((s: RootState) => s.auth.user);
  const route = tenantRouteFromLocation();

  useEffect(() => {
    if (!user) return;
    // La app de escritorio carga desde `file:` y no tiene rutas por host.
    if (window.location.protocol === "file:") return;

    if (route.fromPath) {
      if (!user.tenant) {
        goTo(pathname === "/home" ? "/" : `${pathname}${search}`);
        return;
      }
      if (user.tenant.slug !== route.slug) {
        goTo(`/${user.tenant.slug}${pathname}${search}`);
      }
      return;
    }

    if (user.tenant && !tenantSlugFromHost()) {
      const target = pathname === "/" ? "/home" : pathname;
      goTo(`/${user.tenant.slug}${target}${search}`);
    }
  }, [user, route.fromPath, route.slug, pathname, search]);

  return null;
}

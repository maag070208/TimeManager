import { useSelector } from "react-redux";
import type { RootState } from "@app/store";
import { getSelectedTenant } from "@shared/api/tenant";

/** Pantallas que el personal de plataforma usa sin elegir cliente. */
export const PLATFORM_PATHS = ["/", "/notifications", "/roles", "/plans", "/tenants", "/audit"] as const;

/**
 * Cliente sobre el que opera la sesión. Personal de cliente: el suyo.
 * Plataforma: el elegido en la barra superior, o ninguno (consola de plataforma).
 */
export const useClientContext = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const isPlatform = !!user && !user.tenant;
  const selected = isPlatform ? getSelectedTenant() : null;
  const client = user?.tenant ?? selected;
  return {
    isPlatform,
    client: client ? { id: client.id, name: client.name, slug: client.slug } : null,
    /** Plataforma sin cliente elegido: solo consola, roles y avisos. */
    platformWithoutClient: isPlatform && !selected,
  };
};

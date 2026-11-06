import { useEffect, useState } from "react";
import { authApi, type PublicBranding } from "@entities/user";
import { tenantSlugFromLocation } from "@shared/api/tenant";

export interface LoginTenantState {
  /** Slug del cliente según el path/subdominio; `null` = plataforma. */
  slug: string | null;
  branding: PublicBranding | null;
  loading: boolean;
}

/**
 * Contexto público del login: valida el slug del path contra la API. Un slug
 * inexistente o inactivo regresa `branding.slug = null` (la UI bloquea el
 * acceso del cliente y ofrece el acceso de plataforma).
 */
export const useLoginBrandingState = (): LoginTenantState => {
  const [state, setState] = useState<LoginTenantState>(() => ({
    slug: tenantSlugFromLocation(),
    branding: null,
    loading: true,
  }));

  useEffect(() => {
    let active = true;
    authApi
      .branding(state.slug)
      .then((data) => {
        if (active) setState((prev) => ({ ...prev, branding: data, loading: false }));
      })
      .catch(() => {
        if (active) setState((prev) => ({ ...prev, branding: null, loading: false }));
      });
    return () => {
      active = false;
    };
  }, [state.slug]);

  return state;
};

/** Compatibilidad: solo el branding. */
export const useLoginBranding = (): PublicBranding | null => useLoginBrandingState().branding;

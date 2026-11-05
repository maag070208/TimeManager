import { useEffect, useState } from "react";
import { authApi, type PublicBranding } from "@entities/user";
import { tenantSlugFromLocation } from "@shared/api/tenant";

/**
 * Branding público del cliente (F3-05) para la pantalla de login: nombre,
 * color y logo. Sin cliente (plataforma) o si falla, se usa la marca
 * TimeManager.
 */
export const useLoginBranding = (): PublicBranding | null => {
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  useEffect(() => {
    let active = true;
    const slug = tenantSlugFromLocation();
    authApi
      .branding(slug)
      .then((data) => {
        if (active) setBranding(data);
      })
      .catch(() => {
        if (active) setBranding(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return branding;
};

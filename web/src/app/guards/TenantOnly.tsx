import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import type { RootState } from "@app/store";

/**
 * Pantallas personales de un cliente (p. ej. `/mi-jornada`): solo tienen
 * sentido si la sesión pertenece a un cliente. El personal de plataforma no
 * tiene expediente ni marcajes propios, así que se le manda a su inicio.
 */
export default function TenantOnly({ children }: { children: ReactNode }) {
  const user = useSelector((state: RootState) => state.auth.user);
  if (!user) return null;
  // Al recargar, el usuario persistido es el del login (sin `tenant` ni
  // permisos) hasta que responde `/auth/me`: no redirigir en falso.
  if (user.permissions === undefined) return null;
  // El login no trae `tenant`; `/auth/me` sí (objeto o `null`). Esperar la
  // diferencia entre "aún no cargó" y "es plataforma" evita redirigir en falso.
  if (user.tenant === undefined) return null;
  if (!user.tenant) return <Navigate to="/" replace />;
  return <>{children}</>;
}

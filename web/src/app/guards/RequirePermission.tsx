import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import type { RootState } from "@app/store";
import { usePermission, type Permission } from "@entities/user";

interface Props {
  /** Permiso que debe tener la sesión (con cualquier alcance). */
  permission: Permission;
  children: ReactNode;
}

/**
 * Gate de permiso a nivel de ruta. `PrivateRoutes` ya garantiza que hay sesión;
 * aquí se bloquea el acceso directo por URL a secciones no autorizadas. Mientras
 * el usuario no cargue (`meThunk` en vuelo) no se decide nada para no redirigir
 * en falso.
 */
export default function RequiresPermission({ permission, children }: Props) {
  const user = useSelector((s: RootState) => s.auth.user);
  const scope = usePermission(permission);

  if (!user) return null;
  // Al recargar la página, el usuario persistido puede venir sin permisos hasta
  // que responde `meThunk`: no se redirige en falso (se espera a que carguen).
  if (user.permissions === undefined) return null;
  if (scope === "NONE") return <Navigate to="/" replace />;

  return <>{children}</>;
}

import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@app/store";
import { can } from "@entities/user";
import { useClientContext } from "@features/tenant/tenant-switcher";
import ClientHomePage from "./ClientHomePage";
import PlatformHomePage from "./PlatformHomePage";

/** Permisos del trabajador de a pie (rol PERSONAL): ver su propia asistencia. */
const WORKER_PERMISSIONS = new Set(["attendance.view"]);

/**
 * `/`: consola de plataforma sin cliente elegido; inicio del cliente en
 * cualquier otro caso. Quien solo tiene permisos de trabajador entra directo a
 * checar (`/mi-jornada`): el inicio del cliente no le aporta nada.
 */
export default function HomePage() {
  const { platformWithoutClient } = useClientContext();
  const user = useSelector((s: RootState) => s.auth.user);
  if (platformWithoutClient) return <PlatformHomePage />;

  const permissions = user?.permissions;
  const isWorker =
    Boolean(user?.tenant) &&
    permissions !== undefined &&
    can(permissions, "attendance.view" as keyof typeof permissions) &&
    Object.keys(permissions).every((key) => WORKER_PERMISSIONS.has(key) || !can(permissions, key as keyof typeof permissions));
  if (isWorker) return <Navigate to="/mi-jornada" replace />;

  return <ClientHomePage />;
}

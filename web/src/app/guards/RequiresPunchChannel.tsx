import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import type { RootState } from "@app/store";
import { usePunchChannels } from "@entities/user";
import type { PunchChannel } from "@shared/lib/punch-channels";

interface Props {
  /** Canal que debe tener contratado el cliente para entrar a la pantalla. */
  channel: PunchChannel;
  children: ReactNode;
}

/**
 * Gate de canal de checada a nivel de ruta: sin el canal CLOCK, las pantallas
 * del reloj checador no existen para el cliente (ni por URL directa). No toca
 * el módulo `attendance`: el reporte de Asistencias sigue accesible.
 *
 * Mientras la sesión no sabe con qué cliente opera (`/auth/me` en vuelo) no se
 * decide nada para no expulsar a nadie en falso.
 */
export default function RequiresPunchChannel({ channel, children }: Props) {
  const user = useSelector((state: RootState) => state.auth.user);
  const { channels, ready } = usePunchChannels();

  if (!user) return null;
  if (user.permissions === undefined || !ready) return null;
  if (!channels.includes(channel)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

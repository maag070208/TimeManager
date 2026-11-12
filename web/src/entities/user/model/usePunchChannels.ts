import { useSelector } from "react-redux";
import type { RootState } from "@app/store";
import { getSelectedTenant } from "@shared/api/tenant";
import { punchChannelsOf, type PunchChannel } from "@shared/lib/punch-channels";

/**
 * Canales de checada del cliente vigente (`GET /auth/me` → `tenant.punchChannels`).
 * El personal de plataforma opera un cliente elegido en la barra superior; esa
 * elección se guarda con sus canales para no depender de otra petición.
 *
 * `ready` es falso mientras la sesión aún no sabe si tiene cliente (login sin
 * `/auth/me`): los guards no deben decidir nada en ese momento.
 */
export const usePunchChannels = (): { channels: PunchChannel[]; ready: boolean } => {
  const user = useSelector((state: RootState) => state.auth.user);
  if (!user || user.tenant === undefined) {
    return { channels: punchChannelsOf(null), ready: false };
  }
  const selected = user.tenant ? null : getSelectedTenant();
  return {
    channels: punchChannelsOf(user.tenant?.punchChannels ?? selected?.punchChannels),
    ready: true,
  };
};

/**
 * ¿El cliente de la sesión tiene ese canal? `undefined` = la sesión aún no
 * cargó: la UI puede elegir entre no mostrar nada a medias o asumir el canal.
 */
export const useHasPunchChannel = (channel: PunchChannel): boolean | undefined => {
  const { channels, ready } = usePunchChannels();
  return ready ? channels.includes(channel) : undefined;
};

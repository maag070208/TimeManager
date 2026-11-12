/** Canal por el que un cliente permite checar. Los canales los define la plataforma. */
export type PunchChannel = "WEB" | "APP" | "CLOCK";

/** Los tres canales, en el orden en que los muestra la consola de plataforma. */
export const PUNCH_CHANNELS: readonly PunchChannel[] = ["WEB", "APP", "CLOCK"];

/** Claves i18n (`home` → `platform.channels.*`) del nombre y la ayuda de cada canal. */
export type PunchChannelLabelKey =
  | "platform.channels.web"
  | "platform.channels.app"
  | "platform.channels.clock";
export type PunchChannelHintKey =
  | "platform.channels.webHint"
  | "platform.channels.appHint"
  | "platform.channels.clockHint";

export const PUNCH_CHANNEL_LABEL_KEY: Record<PunchChannel, PunchChannelLabelKey> = {
  WEB: "platform.channels.web",
  APP: "platform.channels.app",
  CLOCK: "platform.channels.clock",
};

export const PUNCH_CHANNEL_HINT_KEY: Record<PunchChannel, PunchChannelHintKey> = {
  WEB: "platform.channels.webHint",
  APP: "platform.channels.appHint",
  CLOCK: "platform.channels.clockHint",
};

/** Clientes sin configuración explícita (sesiones viejas) se comportan como web+app. */
export const DEFAULT_PUNCH_CHANNELS: readonly PunchChannel[] = ["WEB", "APP"];

/** Normaliza los canales del tenant (`/auth/me` → `tenant.punchChannels`). */
export const punchChannelsOf = (channels?: readonly string[] | null): PunchChannel[] =>
  (channels?.length ? channels : DEFAULT_PUNCH_CHANNELS).filter(
    (channel): channel is PunchChannel => channel === "WEB" || channel === "APP" || channel === "CLOCK"
  );

export const hasPunchChannel = (channels: readonly string[] | null | undefined, channel: PunchChannel): boolean =>
  punchChannelsOf(channels).includes(channel);

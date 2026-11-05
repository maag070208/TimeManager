import { env } from "./env.config";

/**
 * URL de entrada de la web para un cliente, derivada de `WEB_ORIGIN`: la
 * entrada con comodín (`https://*.timemanager.mx`) da la del cliente y la
 * primera sin comodín, la de plataforma. Con `WEB_ORIGIN=*` no hay URL.
 */
export const webLoginUrl = (slug: string | null, origins: string = env.WEB_ORIGIN): string | null => {
  const entries = origins.split(",").map((s) => s.trim()).filter((s) => s && s !== "*");
  if (slug) {
    const wildcard = entries.find((e) => e.includes("*."));
    return wildcard ? `${wildcard.replace("*.", `${slug}.`)}/login` : null;
  }
  const plain = entries.find((e) => !e.includes("*"));
  return plain ? `${plain}/login` : null;
};

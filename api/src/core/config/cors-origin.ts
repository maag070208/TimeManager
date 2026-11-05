/**
 * `WEB_ORIGIN` admite `*`, una lista separada por comas y comodines de
 * subdominio (`http://*.localhost:5006`, `https://*.timemanager.mx`): cada
 * cliente entra por su subdominio y todos deben pasar CORS.
 */
export const corsOrigin = (raw: string): true | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void) => {
  const entries = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0 || entries.includes("*")) return true;
  const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const patterns = entries.map(
    (e) => new RegExp(`^${e.split("*.").map(escape).join("([a-z0-9-]+\\.)+")}$`, "i")
  );
  return (origin, cb) => cb(null, !origin || patterns.some((p) => p.test(origin)));
};

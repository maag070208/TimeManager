import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const required = ["DATABASE_URL", "PORT", "JWT_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const intOrUndefined = (value: string | undefined): number | undefined =>
  value === undefined || value.trim() === "" ? undefined : parseInt(value, 10);

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "4001", 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "*",
  JWT_SECRET: process.env.JWT_SECRET!,
  /**
   * Clave para cifrar secretos en reposo (p. ej. la contraseña de cada reloj):
   * base64 de exactamente 32 bytes. Si falta, `core/utils/crypto` la deriva de
   * `JWT_SECRET` con HKDF-SHA256 y avisa una vez; en producción conviene fijarla.
   */
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  /** Vida del refresh token (endurecimiento). */
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  INITIAL_ADMIN_USERNAME: process.env.INITIAL_ADMIN_USERNAME ?? "admin",
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD ?? "admin123",
  ABLY_API_KEY: process.env.ABLY_API_KEY!,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
  AWS_REGION: process.env.AWS_REGION ?? "us-east-2",
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  NOTIFICATION_EMAILS: process.env.NOTIFICATION_EMAILS ?? "",
  UPLOAD_MAX_BYTES: parseInt(process.env.UPLOAD_MAX_BYTES ?? "52428800", 10),
  // Máximo de adjunto que se incluye en los correos de "documento cargado"
  // (Resend limita a 40MB post-base64 por email). Archivos más grandes se
  // envían solo con el enlace en el cuerpo.
  EMAIL_ATTACH_MAX_BYTES: parseInt(process.env.EMAIL_ATTACH_MAX_BYTES ?? "20971520", 10),

  // Cola desatendida de correo (email_logs + worker en background). Intervalo
  // de poll, tamaño de batch por tick, envíos concurrentes por ciclo, intentos
  // máximos por correo y base de backoff exponencial (tope 15 min).
  EMAIL_QUEUE_POLL_MS: parseInt(process.env.EMAIL_QUEUE_POLL_MS ?? "2000", 10),
  EMAIL_QUEUE_BATCH_SIZE: parseInt(process.env.EMAIL_QUEUE_BATCH_SIZE ?? "10", 10),
  EMAIL_QUEUE_CONCURRENCY: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY ?? "5", 10),
  EMAIL_QUEUE_MAX_ATTEMPTS: parseInt(process.env.EMAIL_QUEUE_MAX_ATTEMPTS ?? "5", 10),
  EMAIL_QUEUE_RETRY_BASE_MS: parseInt(process.env.EMAIL_QUEUE_RETRY_BASE_MS ?? "1000", 10),

  // SMTP (nodemailer). Si no se configuran, el mail entra en dry-run.
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_CONNECTION_TIMEOUT: process.env.SMTP_CONNECTION_TIMEOUT
    ? parseInt(process.env.SMTP_CONNECTION_TIMEOUT, 10)
    : undefined,
  SMTP_FROM: process.env.SMTP_FROM,
  EMAIL_DRY_RUN:
    process.env.EMAIL_DRY_RUN === "true" ||
    (process.env.NODE_ENV !== "production" &&
      !process.env.SMTP_HOST &&
      !process.env.RESEND_API_KEY),

  // Relojes checadores Hikvision (ISAPI, SOLO LECTURA). Los relojes se dan de
  // alta desde la web y cada reloj guarda su propio usuario/contraseña
  // cifrados (F1B-10). Este par es solo el fallback de desarrollo/E2E para
  // relojes dados de alta sin credenciales propias; sin ninguno de los dos no
  // se sincroniza (las checadas guardadas siguen consultables).
  //
  // `CHECADOR_USER`/`CHECADOR_PASS` es el nombre VIEJO, y así lo pasan los
  // `docker-compose` ya instalados (el del cliente, por ejemplo). Se acepta como
  // sinónimo para que una instalación con ese nombre no se quede sin relojes:
  // el nombre nuevo manda si están los dos.
  TIME_CLOCK_USER: process.env.TIME_CLOCK_USER ?? process.env.CHECADOR_USER ?? "",
  TIME_CLOCK_PASS: process.env.TIME_CLOCK_PASS ?? process.env.CHECADOR_PASS ?? "",
  TIME_CLOCK_SYNC_INTERVAL_MS: parseInt(process.env.TIME_CLOCK_SYNC_INTERVAL_MS ?? "300000", 10),

  // ── Infraestructura y escala (F1B-01/02/07, F1C-03, F4-03) ───────────────

  /**
   * RLS (Postgres) como red de seguridad: cada operación de un modelo de
   * cliente fija `app.tenant_id` en su transacción. Requiere que `DATABASE_URL`
   * use un rol SIN BYPASSRLS (`tm_app`, ver `prisma/rls/roles.sql`). Apagado
   * por defecto para desarrollo/E2E (el superusuario de pruebas se salta RLS).
   */
  RLS_ENABLED: process.env.RLS_ENABLED === "true",
  /** Límite de conexiones del pool de Prisma (`?connection_limit=`). */
  DATABASE_CONNECTION_LIMIT: intOrUndefined(process.env.DATABASE_CONNECTION_LIMIT),
  /** Espera máxima por una conexión libre del pool (ms). */
  DATABASE_POOL_TIMEOUT: intOrUndefined(process.env.DATABASE_POOL_TIMEOUT),
  /** PgBouncer en modo transacción: Prisma desactiva prepared statements. */
  DATABASE_PGBOUNCER: process.env.DATABASE_PGBOUNCER === "true",
  /**
   * URL del proceso de workers: rol con BYPASSRLS (`tm_worker`) para iterar
   * clientes y drenar colas globales. Si falta se usa `DATABASE_URL`.
   */
  WORKER_DATABASE_URL: process.env.WORKER_DATABASE_URL,
  /** Workers periódicos dentro del proceso API (solo desarrollo/local). */
  RUN_WORKERS_IN_API: process.env.RUN_WORKERS_IN_API === "true",
  /** Cola pg-boss (workers). Apagada en API; el entrypoint de workers la usa. */
  QUEUE_ENABLED: process.env.QUEUE_ENABLED !== "false",
  /** Vida del lock de líder (ms) antes de que otro worker pueda tomarlo. */
  LEADER_LOCK_TTL_MS: parseInt(process.env.LEADER_LOCK_TTL_MS ?? "30000", 10),
  /** Cada cuánto reintenta el lock un worker que no es líder (ms). */
  LEADER_LOCK_RETRY_MS: parseInt(process.env.LEADER_LOCK_RETRY_MS ?? "10000", 10),
  /** `app.set("trust proxy")`: número de saltos (Railway/load balancer) o IPs. */
  TRUST_PROXY: process.env.TRUST_PROXY ?? "",
  /** Límite del body JSON (p. ej. "1mb"). */
  BODY_LIMIT: process.env.BODY_LIMIT ?? "1mb",
  /** Token para `GET /metrics` (si falta, solo ADMIN/SUPPORT con JWT). */
  METRICS_TOKEN: process.env.METRICS_TOKEN ?? "",
  /** Rate limits (por ventana de 15 min salvo indique otra cosa). */
  RATE_LIMIT_DISABLED: process.env.RATE_LIMIT_DISABLED === "true",
  RATE_LIMIT_LOGIN_MAX: parseInt(process.env.RATE_LIMIT_LOGIN_MAX ?? "20", 10),
  RATE_LIMIT_QUERY_MAX: parseInt(process.env.RATE_LIMIT_QUERY_MAX ?? "600", 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
  /** Logs estructurados (JSON) con request-id/tenant/user cuando true. */
  LOG_JSON: process.env.LOG_JSON ?? (process.env.NODE_ENV === "production" ? "true" : "false"),
};

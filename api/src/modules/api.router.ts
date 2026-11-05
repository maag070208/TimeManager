import { Router } from "express";
import { createAuthModule } from "./auth";
import { createUserModule, UserService } from "./users";
import { createDepartmentModule } from "./departments";
import { createAuditModule } from "./audit";
import { createNotificationsModule } from "./notifications";
import { createPersonalModule } from "./hr";
import { createDashboardModule } from "./dashboard";
import { createConfigModule } from "./config";
import { createPermissionsModule } from "./permissions";
import { createEmailModule } from "./email";
import { createAccessModule } from "./access";
import { createSchedulesModule } from "./schedules";
import { createTimeClockModule } from "./time-clock";
import { createOvertimeModule } from "./overtime";
import { createTenantsModule } from "./tenants";
import { EmployeeDocumentService } from "./hr/services/employee-document.service";
import { asyncHandler } from "@core/utils/asyncHandler";
import { setSysConfigService } from "@core/services/mail";
import { LANGUAGE_CONFIG_KEY, setSystemLanguageReader } from "@core/i18n";
import { registerPath } from "@core/swagger/registry";
import { prismaClient } from "@core/config/database";

const authRouter = createAuthModule();
const { departmentRouter, subareaRouter } = createDepartmentModule();

// Puerto de auditoría (DIP).
const { router: auditRouter, service: auditService } = createAuditModule();
const auditPort = {
  createLog: (input: unknown, client?: unknown) =>
    auditService.createLog(
      input as Parameters<typeof auditService.createLog>[0],
      client as Parameters<typeof auditService.createLog>[1]
    ),
};
// Port de notificaciones (DIP).
const { router: notificationRouter, service: notificationService } = createNotificationsModule();
const userRouter = createUserModule(auditPort.createLog, notificationService);
const { router: personalRouter, records: employeeRecords } = createPersonalModule(notificationService, auditPort.createLog);

// Configuración del sistema (sys_config). Se inyecta la función `createLog`
// (no el objeto entero) — mismo fix que en los demás módulos que reciben
// el puerto de auditoría, para no propagar acoplamientos espurios.
const { router: configRouter, service: sysConfigService } = createConfigModule(
  auditPort.createLog
);
// Se expone para el seed de valores por defecto del arranque (`src/index.ts`).
export { sysConfigService };

// Administración de roles y permisos (catálogo + matriz rol → permiso →
// alcance). Recibe el puerto de auditoría (DIP) para registrar cada cambio.
const { router: permissionsRouter } = createPermissionsModule(auditPort.createLog);

// Control de acceso (entradas/salidas). Recibe el puerto de auditoría (DIP) y
// un lector de `sys_config` para la ventana anti-duplicado configurable.
const { router: accessRouter } = createAccessModule({
  audit: auditPort.createLog,
  sysConfig: async (key) => (await sysConfigService.get(key))?.value ?? null,
});

// Bitácora de envíos de correo (email_logs) para el panel admin: server-side
// table, retry de fallidos/cancelados y cancelación de pendientes.
const { router: emailRouter } = createEmailModule();

// Horarios: administración de horarios, asignación masiva y horas extra.
const {
  router: schedulesRouter,
  service: schedulesService,
  weeklyAttendance,
} = createSchedulesModule({
  audit: auditPort.createLog,
  sysConfig: async (key) => (await sysConfigService.get(key))?.value ?? null,
});

// Aprobación de tiempo extra (ADMIN/GERENTE). Reutiliza el cálculo diario del
// módulo de horarios como puerto: dirección única `overtime → horarios`.
const { router: overtimeRouter } = createOvertimeModule({
  calculator: schedulesService,
  audit: auditPort.createLog,
});

// Checador (reloj Hikvision): checadas copiadas del equipo por una
// sincronización periódica de SOLO LECTURA. El worker lo arranca `index.ts`.
// Recibe el puerto de auditoría (vínculos reloj ↔ usuario) y el lector de
// `sys_config` (zona horaria de los reportes).
// Bajas del padrón del reloj: pasan por el mismo servicio que dar de baja
// desde Usuarios (motivo, bitácora y aviso).
const userService = new UserService(prismaClient, auditPort.createLog, notificationService);
const { router: timeClockRouter, startWorker: startTimeClockWorker } = createTimeClockModule({
  audit: auditPort.createLog,
  sysConfig: async (key) => (await sysConfigService.get(key))?.value ?? null,
  deactivateUser: (id, actorId, input) => userService.deactivate(id, actorId, input),
  rosterAlerts: notificationService,
});
export { startTimeClockWorker };

// Boot wiring del servicio de mail: una vez creado SysConfigService, lo
// exponemos al módulo de email para que `sendEmail` resuelva los
// destinatarios desde la BD (con fallback a `NOTIFICATION_EMAILS`).
setSysConfigService(sysConfigService);

// Idioma del sistema para mensajes, correos y notificaciones (sys_config LANGUAGE).
setSystemLanguageReader(async () => (await sysConfigService.get(LANGUAGE_CONFIG_KEY))?.value ?? null);

const apiRouter = Router();

/** Momento de arranque del módulo, para reportar `uptimeSeconds`. */
const startedAt = Date.now();

registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Liveness probe",
  description:
    "Devuelve 200 si el proceso responde. No toca la base de datos: lo usan " +
    "Playwright, Docker y cualquier sonda externa para saber que el servicio está vivo.",
  responses: {
    200: {
      description: "Service alive",
      content: { "application/json": { schema: { type: "object" } } },
    },
  },
});

/**
 * Liveness: el proceso responde. Deliberadamente NO consulta la BD (una sonda
 * de vida no debe fallar por una dependencia) y mantiene el shape que ya
 * consumen Playwright (`webServer.url`) y los tests.
 */
apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "timemanager-api",
    version: "1.0.0",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    ts: new Date().toISOString(),
  });
});

registerPath({
  method: "get",
  path: "/health/ready",
  tags: ["Health"],
  summary: "Readiness probe (checks the database)",
  description:
    "Confirma que la API puede atender tráfico: hace un `SELECT 1` contra la BD. " +
    "Responde 200 si la BD está accesible y 503 si no.",
  responses: {
    200: {
      description: "Service ready (database reachable)",
      content: { "application/json": { schema: { type: "object" } } },
    },
    503: {
      description: "Service not ready (database unreachable)",
      content: { "application/json": { schema: { type: "object" } } },
    },
  },
});

/** Readiness: además de vivir, la BD responde. 503 si la dependencia falla. */
apiRouter.get("/health/ready", async (_req, res) => {
  try {
    await prismaClient.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "up", ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", db: "down", ts: new Date().toISOString() });
  }
});

// Proxy público de la foto del empleado. El bucket S3 no expone CORS al
// origen del navegador; este endpoint sirve la misma-imagen same-origin
// para que la credencial (canvas + fetch) pueda dibujarla sin disparar
// el canvas tainted check. La URL canónica del objeto ya está en pública.
const personalPhotoService = new EmployeeDocumentService();
apiRouter.get(
  "/hr/:id/photo/raw",
  asyncHandler(async (req, res) => {
    const { body, contentType } = await personalPhotoService.downloadPhoto(req.params.id);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(body);
  })
);

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/departments", departmentRouter);
apiRouter.use("/subareas", subareaRouter);
apiRouter.use("/audit", auditRouter);
apiRouter.use("/notifications", notificationRouter);
// Tableros de RH (expedientes incompletos, asistencia de hoy, tiempo extra, huecos del reloj).
const dashboardRouter = createDashboardModule({
  records: employeeRecords,
  weeklyAttendance,
  sysConfig: async (key) => (await sysConfigService.get(key))?.value ?? null,
});
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/hr", personalRouter);
apiRouter.use("/sys-config", configRouter);
apiRouter.use("/permissions", permissionsRouter);
// Clientes de la plataforma (solo personal de plataforma).
apiRouter.use("/tenants", createTenantsModule(auditPort.createLog).router);
apiRouter.use("/mail", emailRouter);
apiRouter.use("/access", accessRouter);
apiRouter.use("/schedules", schedulesRouter);
apiRouter.use("/overtime", overtimeRouter);
apiRouter.use("/time-clock", timeClockRouter);

export default apiRouter;
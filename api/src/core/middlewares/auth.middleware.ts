import { Request, Response, NextFunction } from "express";
import { verifyToken, isRefreshToken, type JwtPayload } from "@core/utils/security";
import { HttpError } from "./error.middleware";
import { prismaClient } from "@core/config/database";
import { scopeOf, isPermission } from "@core/permissions";
import { runWithRlsBypass, runWithTenant } from "@core/tenancy";
import { setRequestPrincipal } from "@core/observability/request-context";
import { logger } from "@core/utils/logger";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
    interface Response {
      locals: {
        user?: JwtPayload;
      };
    }
  }
}

/**
 * Rutas que siguen abiertas con contraseña provisional: la sesión (`GET
 * /auth/me`, que la web necesita para pintar el bloqueo) y el propio cambio.
 * Se compara la ruta sin query sobre `originalUrl`.
 */
const passwordChangePendingRoute = (req: Request): boolean => {
  const path = (req.originalUrl ?? "").split("?")[0].replace(/\/+$/, "");
  return (
    (req.method === "GET" && path.endsWith("/auth/me")) ||
    (req.method === "POST" && path.endsWith("/auth/change-password"))
  );
};

// Verifica la firma del token y, además, que el usuario que dice ser siga
// existiendo y activo en la base de datos. Sin esto, un usuario borrado o
// desactivado (por ejemplo tras un reset de seed) se queda con una sesión
// "válida" en el navegador que truena con errores de FK en cuanto intenta
// crear algo — en vez de eso, aquí se corta con 401 y el interceptor del
// frontend cierra la sesión automáticamente.
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const header = req.headers.authorization;
  if (!header) throw new HttpError(401, "TOKEN_MISSING");
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new HttpError(401, "INVALID_AUTHORIZATION_HEADER");
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(parts[1]);
    // Un refresh token no sirve como access: solo identifica para renovar.
    if (isRefreshToken(payload)) {
      throw new Error("NOT_AN_ACCESS_TOKEN");
    }
  } catch {
    throw new HttpError(401, "INVALID_TOKEN");
  }

  void (async () => {
    // Pre-contexto: el usuario se revalida antes de saber el cliente.
    const user = await runWithRlsBypass(() =>
      prismaClient.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        active: true,
        mustChangePassword: true,
        role: true,
        tenantId: true,
        departmentId: true,
        tenant: { select: { id: true, status: true } },
        extraRoles: { select: { role: true } },
          permissionGrants: {
            where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
            select: { permission: true, scope: true, expiresAt: true },
          },
        },
      })
    );
    if (!user || !user.active) {
      next(new HttpError(401, "INVALID_SESSION"));
      return;
    }
    // El token debe pertenecer al mismo cliente que el usuario en la BD: si lo
    // movieron de tenant (o es un token de otro cliente), la sesión no sirve.
    if ((payload.tenantId ?? null) !== user.tenantId) {
      next(new HttpError(401, "INVALID_SESSION"));
      return;
    }
    // Cliente suspendido: se corta en caliente, aunque el token siga vigente.
    if (user.tenant && user.tenant.status !== "ACTIVE") {
      next(new HttpError(403, "TENANT_SUSPENDED"));
      return;
    }
    // Contraseña provisional: se exige cambiarla también en el servidor (antes
    // solo lo hacía la web). Quedan abiertas la sesión y el propio cambio.
    if (user.mustChangePassword && !passwordChangePendingRoute(req)) {
      next(new HttpError(403, "PASSWORD_CHANGE_REQUIRED"));
      return;
    }

    // El rol y el departamento frescos de la base mandan sobre los claims del
    // JWT: un cambio de rol o de área aplica en la siguiente petición.
    req.user = {
      ...payload,
      role: user.role,
      roles: [user.role, ...user.extraRoles.map((r) => r.role)],
      departmentId: user.departmentId,
      exceptions: user.permissionGrants.map((grant) => ({
        permission: grant.permission,
        scope: grant.scope,
        expiresAt: grant.expiresAt,
      })),
    };

    // Qué cliente gobierna el resto de la petición:
    // - Personal de cliente: siempre su propio tenant (X-Tenant-Id se ignora).
    // - Plataforma (ADMIN/SUPPORT): su contexto es de plataforma salvo que
    //   venga `X-Tenant-Id` con un cliente válido y ACTIVE (suplantación
    //   administrativa para soporte). Un header inválido se rechaza, no se ignora.
    let tenantId = user.tenantId;
    const platform = user.tenantId === null;
    const headerTenant = req.headers["x-tenant-id"];
    if (typeof headerTenant === "string" && headerTenant.trim() !== "") {
      if (!platform || (user.role !== "ADMIN" && user.role !== "SUPPORT")) {
        next(new HttpError(403, "TENANT_HEADER_FORBIDDEN"));
        return;
      }
      const target = await prismaClient.tenant.findFirst({
        where: { id: headerTenant.trim() },
        select: { id: true, status: true },
      });
      if (!target || target.status !== "ACTIVE") {
        next(new HttpError(400, "INVALID_TENANT_HEADER"));
        return;
      }
      tenantId = target.id;
    }
    // Correlación de logs/métricas: quién y qué cliente atiende la petición.
    setRequestPrincipal({
      userId: user.id,
      tenantId,
      roles: [user.role, ...user.extraRoles.map((r) => r.role)],
      permissions: user.permissionGrants.map((grant) => ({ permission: grant.permission, scope: grant.scope, expiresAt: grant.expiresAt })),
    });
    // Todo lo que sigue corre dentro del contexto elegido: la extensión de
    // Prisma filtra/inyecta tenantId solo en este ámbito.
    runWithTenant(tenantId, () => next(), platform).catch((err) => next(err));
  })().catch(next);
};

/**
 * Exige un permiso con cualquier alcance distinto de NINGUNO. Es el reemplazo
 * de `authorize([...])` en las rutas: el alcance por registro lo aplica el
 * servicio con las funciones de `@core/permisos`.
 *
 * Si la clave no está en el catálogo activo, la ruta queda cerrada (403) y se
 * avisa una sola vez por clave: un permiso mal escrito no abre nada.
 */
const warnedPermissions = new Set<string>();

/**
 * Auditoría de intentos denegados (checklist de la guía). Se escribe en
 * segundo plano: un fallo al registrar nunca cambia la respuesta (que ya es 403).
 *
 * F1C-03: sin freno, un cliente en bucle escribiría un `audit_log` por cada
 * 403. Se registra como máximo uno por usuario+permiso+ruta cada ventana
 * (`AUDIT_DENY_WINDOW_MS`, 60 s) y el mapa se poda solo.
 */
const DENY_AUDIT_WINDOW_MS = 60_000;
const MAX_DENY_TRACKED = 5_000;
const recentDenials = new Map<string, number>();

const recordDeniedAccess = (req: Request, permission: string): void => {
  const user = req.user;
  const route = `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`;
  const key = `${user?.id ?? "anon"}:${permission}:${route}`;
  const now = Date.now();
  const last = recentDenials.get(key);
  if (last !== undefined && now - last < DENY_AUDIT_WINDOW_MS) return;
  if (recentDenials.size >= MAX_DENY_TRACKED) {
    for (const [tracked, at] of recentDenials) {
      if (now - at >= DENY_AUDIT_WINDOW_MS) recentDenials.delete(tracked);
    }
    if (recentDenials.size >= MAX_DENY_TRACKED) recentDenials.clear();
  }
  recentDenials.set(key, now);
  void prismaClient.auditLog
    .create({
      data: {
        action: "ACCESS_DENIED",
        entityType: "Permission",
        entityId: permission,
        userId: user?.id ?? null,
        userName: user?.username ?? null,
        metadata: { path: req.originalUrl, method: req.method, route },
      },
    })
    .catch(() => undefined);
};

/**
 * Exige usuario de plataforma (sin cliente) ADEMÁS del permiso. El permiso no
 * basta: una excepción de permiso a un usuario de cliente no debe abrir las
 * consolas de plataforma (roles, políticas, catálogos globales, configuración).
 * Se combina con `requiresPermission`/`requiresAnyPermission` en las rutas.
 */
export const requiresPlatform = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) throw new HttpError(401, "UNAUTHENTICATED");
  if (req.user.tenantId) throw new HttpError(403, "INSUFFICIENT_PERMISSIONS");
  next();
};

export const requiresPermission = (permission: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new HttpError(401, "UNAUTHENTICATED");
    if (!isPermission(permission)) {
      if (!warnedPermissions.has(permission)) {
        warnedPermissions.add(permission);
        logger.warn(
          `Unknown permission "${permission}": the route stays closed (403)`
        );
      }
      recordDeniedAccess(req, permission);
      throw new HttpError(403, "INSUFFICIENT_PERMISSIONS");
    }
    if (scopeOf(req.user, permission) === "NONE") {
      recordDeniedAccess(req, permission);
      throw new HttpError(403, "INSUFFICIENT_PERMISSIONS");
    }
    next();
  };
};

/**
 * Exige **al menos uno** de los permisos. Útil en lecturas compartidas: p. ej.
 * los catálogos de inventario los necesitan tanto quien ve dispositivos como
 * quien crea un préstamo. Cada clave se evalúa de forma independiente.
 */
export const requiresAnyPermission = (permissions: readonly string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) throw new HttpError(401, "UNAUTHENTICATED");
    const allowed = permissions.some(
      (permission) => isPermission(permission) && scopeOf(user, permission) !== "NONE"
    );
    if (!allowed) {
      recordDeniedAccess(req, permissions.join("|"));
      throw new HttpError(403, "INSUFFICIENT_PERMISSIONS");
    }
    next();
  };
};

import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import {
  comparePassword,
  hashPassword,
  signToken,
  signRefreshToken,
  verifyRefreshToken,
  type JwtPayload,
} from "@core/utils/security";
import { systemLanguage } from "@core/i18n";
import { runWithRlsBypass } from "@core/tenancy";
import { HttpError } from "@core/middlewares/error.middleware";
import { userToEntity, entityToAuthUserDto, userToAuthMeDto } from "../mappers/auth.mapper";
import type { AuthMe, LoginResponse } from "../models/dto/auth.dto";

/**
 * Hash bcrypt de relleno (coste 10, como `hashPassword`): se compara contra él
 * cuando el usuario no existe para que el login tarde lo mismo.
 */
const PLACEHOLDER_HASH = "$2a$10$.iy8LUxripqkqQUgMVApXOjoLpFiYNcBBpA1tqLRFbvyrfZY1TscC";

export class AuthService {
  constructor(private readonly db: PrismaClient = prismaClient) {}

  /**
   * Login multi-tenant (F1A-04). `tenantSlug` es el subdominio/cliente:
   * - Con slug: el cliente debe existir y estar ACTIVE; el usuario se busca
   *   por `(tenantId, username)`.
   * - Sin slug: solo usuarios de plataforma (`tenantId IS NULL`: ADMIN/SUPPORT).
   * Un slug inexistente responde 401 genérico (no revela qué clientes hay).
   */
  async login(username: string, password: string, tenantSlug?: string): Promise<LoginResponse> {
    let tenantId: string | null = null;
    if (tenantSlug) {
      const slug = tenantSlug.trim().toLowerCase();
      const tenant = await this.db.tenant.findFirst({ where: { slug } });
      if (!tenant) throw new HttpError(401, "INVALID_CREDENTIALS");
      if (tenant.status !== "ACTIVE") {
        throw new HttpError(403, "TENANT_SUSPENDED", {}, tenant.name);
      }
      tenantId = tenant.id;
    }

    // Pre-contexto: todavía no hay cliente en el contexto de tenancy, así que
    // el lookup va con el bypass controlado de RLS (F1B-01).
    const user = await runWithRlsBypass(() =>
      this.db.user.findFirst({
        where: { username, tenantId },
        include: { extraRoles: { select: { role: true } } },
      })
    );
    // La contraseña se valida ANTES de mirar el estado de la cuenta. Si se
    // respondiera ACCOUNT_DEACTIVATED sin la contraseña correcta, un anónimo
    // podría enumerar usuarios y leer el motivo de la baja (dato sensible).
    // Con un usuario inexistente se compara igual contra un hash de relleno:
    // así el tiempo de respuesta no delata qué nombres de usuario existen.
    const hash = user?.password ?? PLACEHOLDER_HASH;
    const ok = await comparePassword(password, hash);
    if (!user || !ok) throw new HttpError(401, "INVALID_CREDENTIALS");
    if (!user.active) {
      // Cuenta dada de baja. Separamos este caso del "credenciales inválidas"
      // para que la UI muestre el motivo en vez de un error genérico.
      const reason = user.deactivationReason ?? null;
      throw new HttpError(403, "ACCOUNT_DEACTIVATED", {}, reason ? { reason } : undefined);
    }

    const entity = userToEntity(user);
    const payload: JwtPayload = {
      id: entity.id,
      username: entity.username,
      role: entity.role,
      roles: entity.roles,
      departmentId: entity.departmentId,
      tenantId: entity.tenantId,
    };
    const token = signToken(payload);

    return {
      token,
      refreshToken: signRefreshToken({ id: entity.id, username: entity.username, tenantId: entity.tenantId }),
      user: entityToAuthUserDto(entity),
    };
  }

  /** Renueva el access token a partir de un refresh token vigente. */
  async refresh(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new HttpError(401, "INVALID_REFRESH_TOKEN");
    }
    const user = await this.db.user.findUnique({
      where: { id: payload.id },
      include: { extraRoles: { select: { role: true } } },
    });
    // El tenant de la BD manda: si al usuario lo movieron de cliente (o su
    // sesión era de otro tenant), el refresh no sirve.
    if (!user || !user.active || user.tenantId !== (payload.tenantId ?? null)) {
      throw new HttpError(401, "INVALID_SESSION");
    }

    const entity = userToEntity(user);
    const accessPayload: JwtPayload = {
      id: entity.id,
      username: entity.username,
      role: entity.role,
      roles: entity.roles,
      departmentId: entity.departmentId,
      tenantId: entity.tenantId,
    };
    return {
      token: signToken(accessPayload),
      // Rotación: cada refresh entrega uno nuevo.
      refreshToken: signRefreshToken({ id: entity.id, username: entity.username, tenantId: entity.tenantId }),
    };
  }

  /**
   * Cambia la propia contraseña. Con una contraseña provisional
   * (`mustChangePassword`) la web no deja seguir hasta hacerlo.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, password: true },
    });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");

    const ok = await comparePassword(currentPassword, user.password);
    if (!ok) throw new HttpError(400, "INVALID_PASSWORD");
    if (newPassword === currentPassword) throw new HttpError(400, "PASSWORD_UNCHANGED");

    await this.db.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword), mustChangePassword: false },
    });
    await this.db.auditLog.create({
      data: {
        action: "USER_PASSWORD_CHANGED",
        entityType: "User",
        entityId: user.id,
        userId: user.id,
        userName: user.username,
        newState: { mustChangePassword: false },
        metadata: { origen: "cambio obligatorio" },
      },
    });
  }

  /**
   * Branding público de un cliente para la pantalla de login (F3-05). No
   * revela nada sensible: nombre, color y logo. Con un slug desconocido
   * devuelve nulls (la UI usa la marca CheckLab).
   */
  async branding(tenantSlug?: string): Promise<{
    slug: string | null;
    name: string | null;
    brandColor: string | null;
    logoDataUrl: string | null;
  }> {
    const slug = (tenantSlug ?? "").trim().toLowerCase();
    if (!slug) return { slug: null, name: null, brandColor: null, logoDataUrl: null };
    const tenant = await this.db.tenant.findFirst({
      where: { slug, status: "ACTIVE" },
      select: { slug: true, name: true, brandColor: true, logoDataUrl: true },
    });
    return tenant ?? { slug: null, name: null, brandColor: null, logoDataUrl: null };
  }

  async me(userId: string): Promise<AuthMe> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        department: { select: { id: true, name: true } },
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            timezone: true,
            weekStartDay: true,
            disabledModules: true,
            punchChannels: true,
            brandColor: true,
            logoDataUrl: true,
          },
        },
        extraRoles: { select: { role: true } },
        permissionGrants: {
          where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          select: { permission: true, scope: true, expiresAt: true },
        },
      },
    });
    if (!user || !user.active) throw new HttpError(404, "USER_NOT_FOUND");
    return userToAuthMeDto(user, await systemLanguage());
  }
}
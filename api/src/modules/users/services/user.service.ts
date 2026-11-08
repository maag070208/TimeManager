import { Prisma, type PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { hashPassword } from "@core/utils/security";
import { HttpError } from "@core/middlewares/error.middleware";
import { DEFAULT_ROLE_KEY, isAdminRole, isRole, isRoleAllowedFor, roleKeys, staffRoleKeys } from "@core/permissions";
import { formatDateTime, systemLanguage, t } from "@core/i18n";
import { paginatedQuery } from "@core/db/table";
import {
  filterBool,
  filterEnum,
  filterId,
  filterText,
  orderByOf,
  type ITDataTableFetchParams,
  type ITDataTableResponse,
} from "@core/utils/table";
import type { AuditPort } from "@modules/audit";
import type { NotificationPort } from "@modules/notifications";
import { enqueueEmail, enqueueNotificationEmail } from "@core/services/email-queue";
import {
  welcomeEmail,
  userDeactivatedEmail,
  userReactivatedEmail,
} from "@core/services/email-templates";
import type {
  UserCreateInput,
  UserUpdateInput,
  DeactivateUserInput,
} from "../models/dto/user.dto";
import { webLoginUrl } from "@core/config/web-url";
import { currentTenantId, tenantBrand, tenantTransaction } from "@core/tenancy";
import { assertCanAddPeople } from "@core/plans";

const userSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  middleName: true,
  paternalSurname: true,
  maternalSurname: true,
  role: true,
  extraRoles: { select: { role: true } },
  active: true,
  jobTitle: true,
  employeeNumber: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  subareaId: true,
  subarea: { select: { id: true, name: true } },
  deactivatedAt: true,
  deactivatedById: true,
  deactivatedBy: { select: { id: true, name: true } },
  deactivationReason: true,
  createdAt: true,
} as const;

/**
 * Select del directorio para selectores (F1C-05): sin las relaciones de baja
 * (`deactivatedBy`) ni subárea, que no se usan en los pickers.
 */
const employeePickerSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  middleName: true,
  paternalSurname: true,
  maternalSurname: true,
  role: true,
  extraRoles: { select: { role: true } },
  active: true,
  jobTitle: true,
  employeeNumber: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  createdAt: true,
} as const;

/** Tope duro del directorio (F1C-05): nadie pide "todos" sin filtro. */
export const EMPLOYEE_PICKER_MAX_LIMIT = 500;
export const EMPLOYEE_PICKER_DEFAULT_LIMIT = 500;

type UserRole = UserCreateInput["role"];

/** Quien hace la acción, tal como llega en el token. */
export type AccountActor = { id: string; role: string; roles?: string[] };

const actsAsAdmin = (actor: AccountActor): boolean =>
  isAdminRole(actor.role) || (actor.roles ?? []).some((role) => isAdminRole(role));

/**
 * Cuentas de administración: solo otra cuenta de administración da el rol,
 * cambia roles de una cuenta así o le pone contraseña. Nadie cambia su propio rol.
 */
const assertAccountControl = (
  actor: AccountActor | undefined,
  target: { id: string; role: string; extraRoles?: { role: string }[] } | null,
  assignedRoles: string[]
): void => {
  if (!actor || actsAsAdmin(actor)) {
    if (actor && target && actor.id === target.id && assignedRoles.length > 0) {
      throw new HttpError(403, "CANNOT_CHANGE_OWN_ROLE");
    }
    return;
  }
  if (target && actor.id === target.id && assignedRoles.length > 0) throw new HttpError(403, "CANNOT_CHANGE_OWN_ROLE");
  const targetIsAdmin = !!target && (isAdminRole(target.role) || (target.extraRoles ?? []).some((r) => isAdminRole(r.role)));
  if (targetIsAdmin || assignedRoles.some((role) => isAdminRole(role))) {
    throw new HttpError(403, "ADMIN_ACCOUNT_REQUIRES_ADMIN");
  }
};

/** Puerto de auditoría (DIP). Si no se inyecta, los logs no se escriben. */
export type AuditLogger = AuditPort["createLog"];

export class UserService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger,
    private readonly notifications?: NotificationPort
  ) {}

  async list(role?: UserRole) {
    return this.db.user.findMany({
      where: role ? { role } : undefined,
      select: userSelect,
      orderBy: { name: "asc" },
    });
  }

  /**
   * Directorio de personas para selectores (F1C-05): filtros en la BD con tope
   * de filas. Antes se cargaba TODA la tabla con 4 relaciones y se filtraba en
   * memoria. Los filtros desconocidos se ignoran como antes.
   */
  async listEmployees(options: {
    departmentId?: string;
    roles?: string[];
    q?: string;
    includeInactive?: boolean;
    limit?: number;
  } = {}) {
    const requested = options.limit ?? EMPLOYEE_PICKER_DEFAULT_LIMIT;
    const limit = Math.min(Math.max(Math.trunc(requested) || EMPLOYEE_PICKER_DEFAULT_LIMIT, 1), EMPLOYEE_PICKER_MAX_LIMIT);
    const where: Prisma.UserWhereInput = {};
    if (!options.includeInactive) where.active = true;
    if (options.departmentId) where.departmentId = options.departmentId;
    const conditions: Prisma.UserWhereInput[] = [];
    if (options.roles?.length) {
      conditions.push({
        OR: [
          { role: { in: options.roles as never } },
          { extraRoles: { some: { role: { in: options.roles as never } } } },
        ],
      });
    }
    const q = options.q?.trim();
    if (q) {
      conditions.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { middleName: { contains: q, mode: "insensitive" } },
          { paternalSurname: { contains: q, mode: "insensitive" } },
          { maternalSurname: { contains: q, mode: "insensitive" } },
          { employeeNumber: { contains: q, mode: "insensitive" } },
          { jobTitle: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
          { department: { name: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    if (conditions.length > 0) where.AND = conditions;
    return this.db.user.findMany({
      where,
      select: employeePickerSelect,
      orderBy: { name: "asc" },
      take: limit,
    });
  }

  async getById(id: string) {
    return this.db.user.findUniqueOrThrow({
      where: { id },
      select: userSelect,
    });
  }

  async table(
    params: ITDataTableFetchParams,
    callerRole?: string
  ): Promise<ITDataTableResponse<any>> {
    const { filters } = params;
    // Seguridad: fuera de los administradores solo se consulta personal con
    // expediente (nunca cuentas de plataforma). Va en AND: los filtros solo acotan.
    const scope: Prisma.UserWhereInput[] = [];
    if (!isAdminRole(callerRole)) scope.push({ role: { in: staffRoleKeys() } });

    // `name` solo guarda el primer nombre: la búsqueda por nombre cubre los 4 campos.
    const nameFilter = filterText(filters, "name");
    const where: Prisma.UserWhereInput = {
      AND: [
        ...scope,
        ...(nameFilter
          ? [
              {
                OR: [
                  { name: nameFilter },
                  { middleName: nameFilter },
                  { paternalSurname: nameFilter },
                  { maternalSurname: nameFilter },
                ],
              },
            ]
          : []),
      ],
      username: filterText(filters, "username"),
      employeeNumber: filterText(filters, "employeeNumber"),
      role: filterEnum(filters, "role", roleKeys()),
      departmentId: filterId(filters, "departmentId"),
      subareaId: filterId(filters, "subareaId"),
      // Las cuentas dadas de baja siguen en la lista: el filtro es explícito.
      active: filterBool(filters, "active"),
    };

    const orderBy = orderByOf(
      params.sort,
      {
        username: "username",
        name: "name",
        role: "role",
        employeeNumber: "employeeNumber",
        jobTitle: "jobTitle",
        departmentId: (direction) => ({ department: { name: direction } }),
        subareaId: (direction) => ({ subarea: { name: direction } }),
        createdAt: "createdAt",
      },
      // Por defecto, del más nuevo al más viejo.
      [{ createdAt: "desc" }, { id: "desc" }]
    );

    return paginatedQuery({
      model: this.db.user,
      where: where as Record<string, unknown>,
      orderBy: orderBy as unknown as never[],
      select: userSelect as never,
      page: params.page,
      limit: params.limit,
      // Cursor solo con el orden por defecto (createdAt desc, id desc).
      ...(!params.sort
        ? {
            cursor: {
              value: params.cursor,
              where: (value: unknown) => {
                const c = value as { c: string; i: string };
                const at = new Date(c.c);
                return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: c.i } }] };
              },
              from: (row: { createdAt: Date; id: string }) => ({ c: row.createdAt.toISOString(), i: row.id }),
            },
          }
        : {}),
    });
  }

  /**
   * ¿El dato está libre? Consulta la base para que el formulario avise antes de guardar.
   * `exceptId` es la cuenta que se edita: su propio dato no cuenta como duplicado.
   */
  async availability(query: { field: "username" | "email" | "employeeNumber"; value: string; exceptId?: string }) {
    const where = { username: { username: query.value }, email: { email: query.value }, employeeNumber: { employeeNumber: query.value } }[query.field];
    const found = await this.db.user.findFirst({ where, select: { id: true } });
    return { available: !found || found.id === query.exceptId };
  }

  async create(data: UserCreateInput, actorId?: string, by?: AccountActor) {
    const exists = await this.db.user.findFirst({ where: { username: data.username } });
    if (exists) {
      throw new HttpError(409, "USERNAME_TAKEN");
    }

    if (data.employeeNumber) {
      const empExists = await this.db.user.findFirst({
        where: { employeeNumber: data.employeeNumber },
      });
      if (empExists) {
        throw new HttpError(409, "EMPLOYEE_NUMBER_TAKEN");
      }
    }

    if (data.email) {
      const emailExists = await this.db.user.findFirst({
        where: { email: data.email },
      });
      if (emailExists) {
        throw new HttpError(409, "EMAIL_TAKEN");
      }
    }

    const role = data.role ?? DEFAULT_ROLE_KEY;
    if (!isRole(role)) {
      throw new HttpError(400, "INVALID_ROLE", { role });
    }
    const extraRoles = [...new Set(data.roles ?? [])].filter((r) => r !== role);
    for (const extra of extraRoles) {
      if (!isRole(extra)) {
        throw new HttpError(400, "INVALID_ROLE", { role: extra });
      }
    }
    for (const key of [role, ...extraRoles]) {
      if (!isRoleAllowedFor(key, currentTenantId())) throw new HttpError(403, "ROLE_NOT_FOR_CLIENT", { role: key });
    }
    assertAccountControl(by, null, [role, ...extraRoles]);
    await this.assertDepartmentOf(currentTenantId(), data.departmentId);
    await assertCanAddPeople(currentTenantId());

    const created = await tenantTransaction(this.db, async (tx) => {
      const row = await tx.user.create({
        data: {
          username: data.username,
          email: data.email,
          password: await hashPassword(data.password),
          name: data.name,
          middleName: data.middleName,
          paternalSurname: data.paternalSurname,
          maternalSurname: data.maternalSurname,
          role,
          jobTitle: data.jobTitle,
          employeeNumber: data.employeeNumber,
          departmentId: data.departmentId,
          subareaId: data.subareaId,
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          middleName: true,
          paternalSurname: true,
          maternalSurname: true,
          role: true,
          active: true,
          jobTitle: true,
          employeeNumber: true,
          departmentId: true,
          subareaId: true,
        },
      });
      if (extraRoles.length > 0) {
        await tx.userRole.createMany({
          data: extraRoles.map((extra) => ({ userId: row.id, role: extra })),
          skipDuplicates: true,
        });
      }
      return { ...row, extraRoles: extraRoles.map((extra) => ({ role: extra })) };
    });

    const actor = actorId ?? created.id;

    // Notificación in-app a admin/HR (fire-and-forget). No bloquea la respuesta.
    void this.notifications?.notifyUserCreated({
      userId: created.id,
      actorId: actor,
      userName: created.name,
      userEmail: created.email,
    }).catch(() => {
      /* el error ya se registra dentro de la implementación */
    });

    // Welcome email al empleado (fire-and-forget, vía cola desatendida). Solo si
    // hay email. El request no toca Resend/SMTP: solo INSERT en email_logs.
    const lng = await systemLanguage();
    if (created.email) {
      const { subject, html } = welcomeEmail({
        language: lng,
        to: created.email,
        name: created.name,
        username: created.username,
        tempPassword: data.password,
        loginUrl: webLoginUrl((await tenantBrand(currentTenantId()))?.slug ?? null),
      });
      void enqueueEmail({
        to: created.email,
        subject,
        html,
        action: "user.create",
        entityType: "User",
        entityId: created.id,
      });
    }

    // Correo de registro a los NOTIFICATION_EMAILS del catálogo (sys_config).
    // Es una versión distinta a la del empleado: metadata completa de la alta.
    const actorInfo = await this.db.user.findUnique({
      where: { id: actor },
      select: { name: true },
    });
    const actorName = actorInfo?.name ?? t("labels.administrator", {}, lng);
    const departmentName = created.departmentId
      ? (await this.db.department.findUnique({
          where: { id: created.departmentId },
          select: { name: true },
        }))?.name ?? t("labels.unassigned", {}, lng)
      : t("labels.unassigned", {}, lng);
    const registrationDate = formatDateTime(new Date(), lng);

    {
      const { subject, html } = welcomeEmail({
        language: lng,
        to: "",
        name: created.name,
        username: created.username,
        tempPassword: data.password,
        forAdmin: true,
        actorName,
        role: created.role,
        departmentName,
        email: created.email,
        registrationDate,
      });
      void enqueueNotificationEmail({
        subject,
        html,
        action: "user.create",
        entityType: "User",
        entityId: created.id,
      });
    }

    return created;
  }

  /** El departamento debe ser del mismo cliente que la persona. */
  private async assertDepartmentOf(tenantId: string | null | undefined, departmentId: string | null | undefined) {
    if (!departmentId) return;
    const department = await this.db.department.findFirst({
      where: { id: departmentId, ...(tenantId ? { tenantId } : {}) },
      select: { id: true },
    });
    if (!department) throw new HttpError(404, "DEPARTMENT_NOT_FOUND");
  }

  async update(id: string, data: UserUpdateInput, actor?: AccountActor) {
    if (data.role !== undefined && !isRole(data.role)) {
      throw new HttpError(400, "INVALID_ROLE", { role: data.role });
    }
    if (data.roles !== undefined) {
      for (const extra of data.roles) {
        if (!isRole(extra)) {
          throw new HttpError(400, "INVALID_ROLE", { role: extra });
        }
      }
    }
    const current = await this.db.user.findFirst({
      where: { id },
      select: { id: true, role: true, tenantId: true, active: true, extraRoles: { select: { role: true } } },
    });
    if (!current) throw new HttpError(404, "USER_NOT_FOUND");
    const assigned = [...(data.role !== undefined ? [data.role] : []), ...(data.roles ?? [])];
    assertAccountControl(actor, current, assigned);
    // Reactivar va por su propia ruta: revisa el límite del plan y limpia la baja.
    if (data.active === true && !current.active) throw new HttpError(400, "USE_REACTIVATE");
    await this.assertDepartmentOf(current.tenantId, data.departmentId);
    if (data.role !== undefined || data.roles !== undefined) {
      // El cliente del usuario editado manda (no el de quien edita): plataforma
      // sin cliente elegido tampoco puede volver ADMIN a alguien de un cliente.
      const target = await this.db.user.findFirst({ where: { id }, select: { tenantId: true } });
      for (const key of [...(data.role ? [data.role] : []), ...(data.roles ?? [])]) {
        if (!isRoleAllowedFor(key, target?.tenantId)) throw new HttpError(403, "ROLE_NOT_FOR_CLIENT", { role: key });
      }
    }
    if (data.employeeNumber) {
      const dup = await this.db.user.findFirst({
        where: { employeeNumber: data.employeeNumber, NOT: { id } },
      });
      if (dup) {
        throw new HttpError(409, "EMPLOYEE_NUMBER_TAKEN");
      }
    }
    if (data.email) {
      const emailDup = await this.db.user.findFirst({
        where: { email: data.email, NOT: { id } },
      });
      if (emailDup) {
        throw new HttpError(409, "EMAIL_TAKEN");
      }
    }

    const { roles, ...rest } = data;
    return tenantTransaction(this.db, async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: rest,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          middleName: true,
          paternalSurname: true,
          maternalSurname: true,
          role: true,
          active: true,
          jobTitle: true,
          employeeNumber: true,
          departmentId: true,
          subareaId: true,
        },
      });

      if (roles !== undefined) {
        const primary = rest.role ?? row.role;
        const extras = [...new Set(roles)].filter((r) => r !== primary);
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (extras.length > 0) {
          await tx.userRole.createMany({
            data: extras.map((extra) => ({ userId: id, role: extra })),
            skipDuplicates: true,
          });
        }
      }

      const extraRoles = await tx.userRole.findMany({
        where: { userId: id },
        select: { role: true },
      });
      return { ...row, extraRoles };
    });
  }

  async changePassword(id: string, newPassword: string, actor?: AccountActor) {
    const target = await this.db.user.findFirst({
      where: { id },
      select: { id: true, role: true, extraRoles: { select: { role: true } } },
    });
    if (!target) throw new HttpError(404, "USER_NOT_FOUND");
    assertAccountControl(actor, target, []);
    // La contraseña que pone un administrador es provisional: la persona debe
    // cambiarla al entrar (mismo candado que la carga del cruce).
    return this.db.user.update({
      where: { id },
      data: { password: await hashPassword(newPassword), mustChangePassword: true },
      select: { id: true },
    });
  }

  async remove(id: string, actorId?: string, force = false) {
    const user = await this.db.user.findUnique({ where: { id } });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");

    // Eliminación forzada (solo ADMIN, gateado en la ruta): borra aunque el
    // usuario tenga historial ligado. Las FKs requeridas (no admiten null) se
    // reasignan al administrador que ejecuta la acción; las opcionales se
    // limpian. Salta el paso intermedio de baja lógica.
    if (force) {
      if (!actorId) {
        throw new HttpError(400, "ACTING_ADMIN_UNKNOWN");
      }
      if (actorId === id) {
        throw new HttpError(400, "CANNOT_DELETE_SELF");
      }
      const actor = await this.db.user.findUnique({ where: { id: actorId } });
      if (!actor) throw new HttpError(400, "ADMIN_NOT_FOUND");

      await this.db.$transaction([
      ]);

      const data = await this.db.user.delete({
        where: { id },
        select: { id: true, username: true, name: true, role: true, active: true },
      });
      return { soft: false, forced: true, data };
    }

    // Primera eliminación: soft (active=false), igual que departamentos.
    if (user.active) {
      const data = await this.db.user.update({
        where: { id },
        data: { active: false },
        select: { id: true, username: true, name: true, role: true, active: true },
      });
      return { soft: true, data };
    }

    // Segunda eliminación (usuario ya inactivo): física. Si el historial ligado
    // (accesos, checadas, documentos, etc.) lo impide, la BD rechaza el borrado
    // (FK restrict) y se responde con el bloqueo, sin tocar nada.
    try {
      const data = await this.db.user.delete({
        where: { id },
        select: { id: true, username: true, name: true, role: true, active: true },
      });
      return { soft: false, data };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new HttpError(400, "USER_HAS_HISTORY", { blockers: t("userDeleteBlockers.history") });
      }
      throw error;
    }
  }

  /**
   * Da de baja a un usuario (soft deactivate). Mantiene `active=false` y
   * registra quién/cuándo/por qué. Envuelto en `$transaction` para que el
   * log de auditoría quede atado al cambio de estado.
   *
   * Rechaza darse de baja a sí mismo (HTTP 400) y dobles bajas (HTTP 409).
   */
  async deactivate(id: string, actorId: string, input: DeactivateUserInput) {
    if (actorId === id) {
      throw new HttpError(400, "CANNOT_DEACTIVATE_SELF");
    }

    const result = await tenantTransaction(this.db, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, username: true, name: true, role: true, active: true, email: true, deactivatedAt: true },
      });
      if (!user) throw new HttpError(404, "USER_NOT_FOUND");
      if (!user.active) {
        throw new HttpError(409, "USER_ALREADY_DEACTIVATED");
      }

      // El motivo, si viene, debe existir y estar activo en el catálogo.
      const categoryId = input.categoryId ?? null;
      if (categoryId) {
        const category = await tx.removalCategory.findFirst({
          where: { id: categoryId, active: true },
          select: { id: true },
        });
        if (!category) throw new HttpError(400, "REMOVAL_CATEGORY_INVALID");
      }

      const previousState = { active: true };

      const updated = await tx.user.update({
        where: { id },
        data: {
          active: false,
          deactivatedAt: new Date(),
          deactivatedById: actorId,
          deactivationReason: input.reason,
          deactivationCategoryId: categoryId,
        },
        select: userSelect,
      });

      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: { id: true, name: true },
      });

      if (this.audit) {
        await this.audit(
          {
            action: "USER_DEACTIVATED",
            entityType: "User",
            entityId: id,
            userId: actorId,
            previousState,
            newState: {
              active: false,
              deactivatedAt: updated.deactivatedAt,
              deactivatedById: actorId,
              deactivationReason: input.reason,
              deactivationCategoryId: categoryId,
            },
            metadata: { reason: input.reason, notifyUser: input.notifyUser },
          },
          tx
        );
      }

      return { updated, user, actor };
    });

    // Notificación in-app a admin/HR (fire-and-forget).
    const lng = await systemLanguage();
    const retirementDate = formatDateTime(
      result.updated.deactivatedAt ? new Date(result.updated.deactivatedAt) : new Date(),
      lng
    );
    const actorName = result.actor?.name ?? t("labels.administrator", {}, lng);

    void this.notifications?.notifyUserDeactivated({
      userId: result.user.id,
      actorId,
      userName: result.user.name,
      reason: input.reason,
      date: retirementDate,
    }).catch(() => {
      /* el error ya se registra dentro de la implementación */
    });

    // Notificación al usuario dado de baja (fire-and-forget, vía cola). El correo
    // del afectado respeta el checkbox `notifyUser` de la UI.
    if (input.notifyUser && result.user.email) {
      const { subject, html } = userDeactivatedEmail({
        language: lng,
        to: result.user.email,
        name: result.user.name,
        reason: input.reason,
        date: retirementDate,
        byName: actorName,
      });
      void enqueueEmail({
        to: result.user.email,
        subject,
        html,
        action: "user.deactivate",
        entityType: "User",
        entityId: result.user.id,
      });
    }

    // Correo de registro a los NOTIFICATION_EMAILS del catálogo (sys_config).
    // Se envía SIEMPRE, sin importar `notifyUser`: es la constancia del evento.
    {
      const { subject, html } = userDeactivatedEmail({
        language: lng,
        to: "",
        name: result.user.name,
        reason: input.reason,
        date: retirementDate,
        byName: actorName,
        forAdmin: true,
        role: result.user.role,
      });
      void enqueueNotificationEmail({
        subject,
        html,
        action: "user.deactivate",
        entityType: "User",
        entityId: result.user.id,
      });
    }

    return result.updated;
  }

  /**
   * Reactiva un usuario previamente dado de baja. Limpia los campos de
   * desactivación y registra el cambio en auditoría.
   */
  async reactivate(id: string, actorId: string) {
    if (actorId === id) {
      throw new HttpError(400, "CANNOT_REACTIVATE_SELF");
    }

    const result = await tenantTransaction(this.db, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, username: true, name: true, role: true, active: true, deactivatedAt: true, deactivationReason: true },
      });
      if (!user) throw new HttpError(404, "USER_NOT_FOUND");
      if (user.active) {
        throw new HttpError(409, "USER_ALREADY_ACTIVE");
      }
      // Volver a activar ocupa un lugar del plan, igual que un alta.
      await assertCanAddPeople(currentTenantId());

      const previousState = {
        active: false,
        deactivatedAt: user.deactivatedAt,
        deactivationReason: user.deactivationReason,
      };

      const updated = await tx.user.update({
        where: { id },
        data: {
          active: true,
          deactivatedAt: null,
          deactivatedById: null,
          deactivationReason: null,
        },
        select: userSelect,
      });

      if (this.audit) {
        await this.audit(
          {
            action: "USER_REACTIVATED",
            entityType: "User",
            entityId: id,
            userId: actorId,
            previousState,
            newState: { active: true },
          },
          tx
        );
      }

      return updated;
    });

    const actor = await this.db.user.findUnique({
      where: { id: actorId },
      select: { name: true },
    });
    const lng = await systemLanguage();
    const actorName = actor?.name ?? t("labels.administrator", {}, lng);
    const date = formatDateTime(new Date(), lng);

    // Notificación al empleado reactivado (fire-and-forget, vía cola). Solo si
    // tiene correo propio.
    if (result.email) {
      const { subject, html } = userReactivatedEmail({
        language: lng,
        to: result.email,
        name: result.name,
        date,
        byName: actorName,
      });
      void enqueueEmail({
        to: result.email,
        subject,
        html,
        action: "user.reactivate",
        entityType: "User",
        entityId: result.id,
      });
    }

    // Correo de registro a los NOTIFICATION_EMAILS del catálogo (sys_config).
    {
      const { subject, html } = userReactivatedEmail({
        language: lng,
        to: "",
        name: result.name,
        date,
        byName: actorName,
        forAdmin: true,
        role: result.role,
      });
      void enqueueNotificationEmail({
        subject,
        html,
        action: "user.reactivate",
        entityType: "User",
        entityId: result.id,
      });
    }

    return result;
  }
}
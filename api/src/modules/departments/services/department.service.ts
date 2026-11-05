import type { Prisma, PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { paginatedQuery } from "@core/db/table";
import {
  filterBool,
  filterExact,
  filterText,
  orderByOf,
  type ITDataTableFetchParams,
  type ITDataTableResponse,
} from "@core/utils/table";
import type { DepartmentCreateInput, DepartmentUpdateInput } from "../models/dto/department.dto";

export class DepartmentService {
  constructor(private readonly db: PrismaClient = prismaClient) {}

  async list(includeInactive = false) {
    return this.db.department.findMany({
      where: includeInactive ? undefined : { active: true },
      include: {
        subareas: {
          where: { active: true },
          orderBy: { name: "asc" },
        },
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async table(params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> {
    const { filters } = params;
    const subarea = filterText(filters, "subareas");
    const where: Prisma.DepartmentWhereInput = {
      // La columna elige un departamento (ITSearchSelect): el nombre es único.
      name: filterExact(filters, "name"),
      active: filterBool(filters, "active"),
      ...(subarea && { subareas: { some: { active: true, name: subarea } } }),
    };

    const orderBy = orderByOf(
      params.sort,
      {
        name: "name",
        count: (direction) => ({ users: { _count: direction } }),
        createdAt: "createdAt",
      },
      [{ name: "asc" }]
    );

    const include: Prisma.DepartmentInclude = {
      subareas: {
        where: { active: true },
        orderBy: { name: "asc" },
      },
      _count: { select: { users: true } },
    };

    return paginatedQuery<any>({
      model: this.db.department,
      where: where as Record<string, unknown>,
      orderBy: orderBy as unknown as never[],
      include: include as never,
      page: params.page,
      limit: params.limit,
    });
  }

  async getById(id: string) {
    const d = await this.db.department.findUnique({
      where: { id },
      include: {
        subareas: { orderBy: { name: "asc" } },
        _count: { select: { users: true } },
      },
    });
    if (!d) throw new HttpError(404, "DEPARTMENT_NOT_FOUND");
    return d;
  }

  async create(data: DepartmentCreateInput) {
    const existing = await this.db.department.findUnique({ where: { name: data.name } });
    if (existing) throw new HttpError(409, "DEPARTMENT_NAME_TAKEN");
    return this.db.department.create({ data: { name: data.name.toUpperCase() } });
  }

  async update(id: string, data: DepartmentUpdateInput) {
    if (data.name) {
      const dup = await this.db.department.findFirst({
        where: { name: data.name.toUpperCase(), NOT: { id } },
      });
      if (dup) throw new HttpError(409, "DUPLICATE_NAME");
    }
    return this.db.department.update({
      where: { id },
      data: {
        ...data,
        ...(data.name ? { name: data.name.toUpperCase() } : {}),
      },
    });
  }

  async remove(id: string) {
    const dept = await this.db.department.findUnique({ where: { id } });
    if (!dept) throw new HttpError(404, "DEPARTMENT_NOT_FOUND");

    const userCount = await this.db.user.count({
      where: { departmentId: id, active: true },
    });
    if (userCount > 0) {
      throw new HttpError(400, "HAS_USERS", { count: userCount });
    }

    // Primera eliminación: soft (active=false). Segunda: físico.
    if (dept.active) {
      const data = await this.db.department.update({
        where: { id },
        data: { active: false },
      });
      return { soft: true, data };
    }

    const data = await this.db.department.delete({ where: { id } });
    return { soft: false, data };
  }
}
import { Request, Response } from "express";
import { parseTableParams, paginatedTable } from "@core/utils/table";
import { HttpError } from "@core/middlewares/error.middleware";
import { roleKeys } from "@core/permissions";
import { parseFirstSheet, pickColumn } from "@core/utils/xlsxParse";
import {
  UserAvailabilityQuery,
  UserCreateDto,
  UserUpdateDto,
  UserPasswordDto,
  DeactivateUserDto,
  SetUserPermissionExceptionDto,
  type UserCreateInput,
} from "../models/dto/user.dto";
import { UserService } from "../services/user.service";
import { UserHistoryService } from "../services/user-history.service";
import { UserImportService } from "../services/user-import.service";
import { UserPermissionsService } from "../services/user-permissions.service";

const VALID_ROLES = (): string[] => roleKeys();

export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly historyService: UserHistoryService,
    private readonly importService: UserImportService,
    private readonly permissions: UserPermissionsService
  ) {}

  list = async (req: Request, res: Response) => {
    const rawRole = typeof req.query.role === "string" ? req.query.role : undefined;
    const validRoles = VALID_ROLES();
    const role = rawRole && validRoles.includes(rawRole) ? (rawRole as UserCreateInput["role"]) : undefined;
    const data = await this.users.list(role);
    res.json(data);
  };

  getById = async (req: Request, res: Response) => {
    const data = await this.users.getById(req.params.id);
    res.json(data);
  };

  table = async (req: Request, res: Response) => {
    const params = parseTableParams(req.body);
    const { data, total, nextCursor } = await this.users.table(params, req.user?.role);
    res.json(paginatedTable(params, data, total, nextCursor));
  };

  availability = async (req: Request, res: Response) => {
    const query = UserAvailabilityQuery.parse(req.body);
    res.json(await this.users.availability(query));
  };

  listEmployees = async (req: Request, res: Response) => {
    const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : undefined;
    const rolesParam = typeof req.query.roles === "string" ? req.query.roles : undefined;
    const rolesFilter = rolesParam
      ? rolesParam
          .split(",")
          .map((r) => r.trim())
          .filter((r): r is string => VALID_ROLES().includes(r))
      : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    // Opciones de filtros de tablas: también quien ya se dio de baja tiene registros.
    const includeInactive = req.query.includeInactive === "true";
    // Tope de filas (F1C-05): el directorio ya no carga la tabla completa.
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

    const data = await this.users.listEmployees({
      departmentId,
      roles: rolesFilter,
      q,
      includeInactive,
      limit,
    });
    res.json(data);
  };

  create = async (req: Request, res: Response) => {
    const input = UserCreateDto.parse(req.body);
    const data = await this.users.create(input, req.user!.id);
    res.status(201).json(data);
  };

  update = async (req: Request, res: Response) => {
    const input = UserUpdateDto.parse(req.body);
    const data = await this.users.update(req.params.id, input);
    res.json(data);
  };

  changePassword = async (req: Request, res: Response) => {
    const { password } = UserPasswordDto.parse(req.body);
    await this.users.changePassword(req.params.id, password);
    res.status(204).send();
  };

  remove = async (req: Request, res: Response) => {
    const force = req.query.force === "true" || req.body?.force === true;
    const data = await this.users.remove(req.params.id, req.user?.id, force);
    res.json(data);
  };

  deactivate = async (req: Request, res: Response) => {
    const input = DeactivateUserDto.parse(req.body);
    const data = await this.users.deactivate(req.params.id, req.user!.id, input);
    res.json(data);
  };

  reactivate = async (req: Request, res: Response) => {
    const data = await this.users.reactivate(req.params.id, req.user!.id);
    res.json(data);
  };

  history = async (req: Request, res: Response) => {
    const data = await this.historyService.getHistory(req.params.id);
    res.json(data);
  };

  listPermissions = async (req: Request, res: Response) => {
    res.json(await this.permissions.list(req.params.id));
  };

  setPermission = async (req: Request, res: Response) => {
    const dto = SetUserPermissionExceptionDto.parse(req.body);
    res.json(await this.permissions.set(req.params.id, req.params.permission, dto, req.user!));
  };

  removePermission = async (req: Request, res: Response) => {
    res.json(await this.permissions.remove(req.params.id, req.params.permission, req.user!.id));
  };

  /** Plantilla .xlsx del formato de carga (mismas columnas que `importUsers`). */
  importTemplate = async (_req: Request, res: Response) => {
    const buffer = this.importService.template();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="plantilla-usuarios.xlsx"');
    res.setHeader("Content-Length", String(buffer.length));
    res.send(buffer);
  };

  importUsers = async (req: Request, res: Response) => {
    if (!req.file) throw new HttpError(400, "EXCEL_FILE_REQUIRED");

    // Encabezados del Excel del cliente (en español) o sus equivalentes en inglés.
    const rawRows = parseFirstSheet(req.file.buffer);
    const rows = rawRows.map((r) => ({
      name: pickColumn(r, ["NOMBRE DEL EMPLEADO", "NOMBRE", "EMPLOYEE NAME", "NAME"]),
      username: pickColumn(r, ["NOMBRE DE USUARIO", "USUARIO", "USERNAME"]),
      password: pickColumn(r, ["CONTRASEÑA", "CONTRASENA", "PASSWORD"]),
    }));

    const data = await this.importService.import(rows);
    res.status(201).json(data);
  };
}
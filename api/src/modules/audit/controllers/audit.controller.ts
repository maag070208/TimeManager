import { Request, Response } from "express";
import { AuditService } from "../services/audit.service";

export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  list = async (req: Request, res: Response) => {
    const data = await this.auditService.list({
      tenantId: typeof req.query.tenantId === "string" ? req.query.tenantId : undefined,
      module: typeof req.query.module === "string" ? req.query.module : undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      entityType: typeof req.query.entityType === "string" ? req.query.entityType : undefined,
      entityId: typeof req.query.entityId === "string" ? req.query.entityId : undefined,
      userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
      start: typeof req.query.start === "string" ? req.query.start : undefined,
      end: typeof req.query.end === "string" ? req.query.end : undefined,
      page: req.query.page && !Number.isNaN(Number(req.query.page)) ? Number(req.query.page) : undefined,
      limit: req.query.limit && !Number.isNaN(Number(req.query.limit)) ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === "string" && req.query.cursor !== "" ? req.query.cursor : undefined,
    });
    res.json(data);
  };

  getOne = async (req: Request, res: Response) => {
    const data = await this.auditService.getById(req.params.id);
    res.json(data);
  };
}
import { Request, Response } from "express";
import { HttpError } from "@core/middlewares/error.middleware";
import { TenantCreateDto, TenantUpdateDto } from "../models/dto/tenant.dto";
import type { TenantService } from "../services/tenant.service";

const actorOf = (req: Request) => {
  if (!req.user) throw new HttpError(401, "UNAUTHENTICATED");
  return { id: req.user.id, username: req.user.username };
};

export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  list = async (_req: Request, res: Response) => {
    res.json(await this.tenants.list());
  };

  getOne = async (req: Request, res: Response) => {
    res.json(await this.tenants.getById(req.params.id));
  };

  create = async (req: Request, res: Response) => {
    const input = TenantCreateDto.parse(req.body);
    res.status(201).json(await this.tenants.create(input, actorOf(req)));
  };

  update = async (req: Request, res: Response) => {
    const input = TenantUpdateDto.parse(req.body);
    res.json(await this.tenants.update(req.params.id, input, actorOf(req)));
  };
}

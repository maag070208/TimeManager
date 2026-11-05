import { Request, Response } from "express";
import { HttpError } from "@core/middlewares/error.middleware";
import { PlanCreateDto, PlanUpdateDto } from "../models/dto/plan.dto";
import type { PlanService } from "../services/plan.service";

const actorOf = (req: Request) => {
  if (!req.user) throw new HttpError(401, "UNAUTHENTICATED");
  return { id: req.user.id, username: req.user.username };
};

export class PlanController {
  constructor(private readonly plans: PlanService) {}

  list = async (req: Request, res: Response) => {
    res.json(await this.plans.list(req.query.includeInactive === "true"));
  };

  getOne = async (req: Request, res: Response) => {
    res.json(await this.plans.getById(req.params.id));
  };

  create = async (req: Request, res: Response) => {
    const input = PlanCreateDto.parse(req.body);
    res.status(201).json(await this.plans.create(input, actorOf(req)));
  };

  update = async (req: Request, res: Response) => {
    const input = PlanUpdateDto.parse(req.body);
    res.json(await this.plans.update(req.params.id, input, actorOf(req)));
  };

  /** Baja lógica: el plan deja de ofrecerse pero los clientes actuales lo conservan. */
  remove = async (req: Request, res: Response) => {
    res.json(await this.plans.deactivate(req.params.id, actorOf(req)));
  };
}

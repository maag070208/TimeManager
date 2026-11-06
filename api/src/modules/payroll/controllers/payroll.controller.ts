import type { Request, Response } from "express";
import { requireTenantId } from "@core/tenancy";
import type { PayrollSettingsService } from "../services/payroll-settings.service";
import { PayrollCalculateDto, PayrollPositionAssignDto, PayrollPositionCreateDto, PayrollPositionUpdateDto, PayrollSettingsUpdateDto } from "../models/dto/payroll.dto";

const actorOf = (req: Request) => ({ id: req.user!.id, name: req.user!.username });

export class PayrollController {
  constructor(private readonly service: PayrollSettingsService) {}

  settings = async (_req: Request, res: Response) => {
    res.json(await this.service.get(requireTenantId()));
  };

  updateSettings = async (req: Request, res: Response) => {
    res.json(
      await this.service.update(
        requireTenantId(),
        actorOf(req),
        PayrollSettingsUpdateDto.parse(req.body)
      )
    );
  };

  positions = async (_req: Request, res: Response) => {
    res.json(await this.service.listPositions(requireTenantId()));
  };

  createPosition = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.createPosition(requireTenantId(), actorOf(req), PayrollPositionCreateDto.parse(req.body)));
  };

  updatePosition = async (req: Request, res: Response) => {
    res.json(await this.service.updatePosition(requireTenantId(), req.params.id, actorOf(req), PayrollPositionUpdateDto.parse(req.body)));
  };

  assignPosition = async (req: Request, res: Response) => {
    res.json(await this.service.assignPosition(requireTenantId(), req.params.id, PayrollPositionAssignDto.parse(req.body).userIds));
  };

  calculate = async (req: Request, res: Response) => {
    res.json(
      await this.service.calculate(requireTenantId(), PayrollCalculateDto.parse(req.body))
    );
  };
}

import type { Request, Response } from "express";
import { requireTenantId } from "@core/tenancy";
import type { PayrollSettingsService } from "../services/payroll-settings.service";
import { PayrollCalculateDto, PayrollSettingsUpdateDto } from "../models/dto/payroll.dto";

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

  calculate = async (req: Request, res: Response) => {
    res.json(
      await this.service.calculate(requireTenantId(), PayrollCalculateDto.parse(req.body))
    );
  };
}

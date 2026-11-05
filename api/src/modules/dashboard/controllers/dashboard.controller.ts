import { Request, Response } from "express";
import { HttpError } from "@core/middlewares/error.middleware";
import type { UserPermissions } from "@core/permissions";
import type { PeopleDashboardService } from "../services/people-dashboard.service";

export class DashboardController {
  constructor(
    private readonly people: PeopleDashboardService
  ) {}

  private actor(req: Request): UserPermissions {
    if (!req.user) throw new HttpError(401, "UNAUTHENTICATED");
    return { id: req.user.id, role: req.user.role, departmentId: req.user.departmentId };
  }

  hrRecords = async (_req: Request, res: Response) => {
    res.json(await this.people.hrRecords());
  };

  peopleOverview = async (req: Request, res: Response) => {
    res.json(await this.people.people(this.actor(req)));
  };

  attendanceToday = async (req: Request, res: Response) => {
    res.json(await this.people.attendanceToday(this.actor(req)));
  };

  overtimeWeek = async (_req: Request, res: Response) => {
    res.json(await this.people.overtimeWeek());
  };

  setupGaps = async (_req: Request, res: Response) => {
    res.json(await this.people.setupGaps());
  };

}

import { Request, Response } from "express";
import { HttpError } from "@core/middlewares/error.middleware";
import { ChangePasswordInputSchema, LoginInputSchema, RefreshInputSchema } from "../models/dto/auth.dto";
import { AuthService } from "../services/auth.service";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (req: Request, res: Response) => {
    const { username, password, tenant } = LoginInputSchema.parse(req.body);
    const result = await this.service.login(username, password, tenant);
    res.json(result);
  };

  /** Branding público del cliente (login): nombre/color/logo, sin sesión. */
  branding = async (req: Request, res: Response) => {
    const tenant = typeof req.query.tenant === "string" ? req.query.tenant : undefined;
    res.json(await this.service.branding(tenant));
  };

  refresh = async (req: Request, res: Response) => {
    const { refreshToken } = RefreshInputSchema.parse(req.body);
    res.json(await this.service.refresh(refreshToken));
  };

  me = async (req: Request, res: Response) => {
    if (!req.user) throw new HttpError(401, "UNAUTHENTICATED");
    const result = await this.service.me(req.user.id);
    res.json(result);
  };

  /** Cambio de la propia contraseña (obligatorio si es provisional). */
  changePassword = async (req: Request, res: Response) => {
    if (!req.user) throw new HttpError(401, "UNAUTHENTICATED");
    const { currentPassword, newPassword } = ChangePasswordInputSchema.parse(req.body);
    await this.service.changePassword(req.user.id, currentPassword, newPassword);
    res.status(204).send();
  };
}
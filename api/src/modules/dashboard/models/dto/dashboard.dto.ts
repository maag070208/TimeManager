import { z } from "zod";
import { registry } from "@core/swagger/registry";

const DashboardActivitySchema = registry.register(
  "DashboardActivity",
  z
    .object({
      id: z.string(),
      scope: z.enum(["devices", "materialOutputs", "inventory"]),
      message: z.string(),
      at: z.string(),
      targetId: z.string().nullable(),
      deviceId: z.string().nullable(),
    })
    .openapi("DashboardActivity")
);

export const DashboardSummarySchema = registry.register(
  "DashboardSummary",
  z
    .object({
      devices: z.object({
        total: z.number(),
        available: z.number(),
        assigned: z.number(),
        retirement: z.number(),
      }),
      materialOutputs: z.object({ total: z.number(), damaged: z.number() }),
      departments: z.number(),
      employees: z.number(),
      recentActivity: z.array(DashboardActivitySchema),
    })
    .openapi("DashboardSummary")
);

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

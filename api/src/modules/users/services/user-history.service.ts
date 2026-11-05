import { t } from "@core/i18n";
import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import type { UserHistoryEntryEntity } from "../models/entity/user.entity";

export class UserHistoryService {
  constructor(private readonly db: PrismaClient = prismaClient) {}

  async getHistory(userId: string): Promise<UserHistoryEntryEntity[]> {
    const entries: UserHistoryEntryEntity[] = [];

    const auditLogs = await this.db.auditLog.findMany({
      where: { entityType: "User", entityId: userId },
      select: { id: true, action: true, newState: true, metadata: true, userId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    for (const log of auditLogs) {
      if (log.action === "USER_DEACTIVATED") {
        const reason =
          (log.metadata as { reason?: string } | null)?.reason ?? t("userHistory.noReason");
        entries.push({
          id: `audit-${log.id}`,
          type: "USER_DEACTIVATED",
          title: t("userHistory.deactivated"),
          detail: t("userHistory.deactivatedDetail", { reason }),
          timestamp: log.createdAt,
        });
      } else if (log.action === "USER_REACTIVATED") {
        entries.push({
          id: `audit-${log.id}`,
          type: "USER_REACTIVATED",
          title: t("userHistory.reactivated"),
          detail: t("userHistory.reactivatedDetail"),
          timestamp: log.createdAt,
        });
      }
    }

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return entries;
  }
}
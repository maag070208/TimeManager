import type { PrismaClient } from "@prisma/client";
import { loadPoliciesFromDb } from "./engine";

/**
 * Políticas ABAC base que se siembran al arrancar (insert-missing por `key`).
 *
 * El producto no trae reglas de fábrica: las que había eran de compras y
 * facturas del ERP origen y se retiraron en L-03. El catálogo de acciones sigue
 * disponible para que la consola de roles cree las que el cliente necesite.
 */
interface SeedCondition {
  field: string;
  operator: string;
  value?: string | null;
}

interface SeedPolicy {
  key: string;
  name: string;
  description: string;
  action: string;
  effect: "ALLOW" | "DENY";
  priority: number;
  active: boolean;
  roles: string[];
  conditions: SeedCondition[];
}

export const DEFAULT_POLICIES: readonly SeedPolicy[] = [];

/**
 * Siembra las políticas base (insert-missing) y deja la cache cargada. Idempotente.
 */
export const seedPoliciesFromFixtures = async (db: PrismaClient): Promise<void> => {
  for (const policy of DEFAULT_POLICIES) {
    const existing = await db.policy.findUnique({ where: { key: policy.key } });
    if (existing) continue;
    await db.policy.create({
      data: {
        key: policy.key,
        name: policy.name,
        description: policy.description,
        action: policy.action,
        effect: policy.effect,
        priority: policy.priority,
        active: policy.active,
        conditions: {
          create: policy.conditions.map((condition) => ({
            field: condition.field,
            operator: condition.operator,
            value: condition.value ?? null,
          })),
        },
        roles: { create: policy.roles.map((role) => ({ role })) },
      },
    });
  }
  await loadPoliciesFromDb(db);
};

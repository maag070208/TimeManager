import { isTenantModel } from "./models";
import { currentTenantId } from "./context";
import { scopeArgs } from "./scope";

/**
 * Extensión de Prisma que aplica el aislamiento por cliente a TODAS las
 * operaciones de los modelos de tenant: nadie filtra `tenantId` a mano.
 * Sin contexto de cliente (plataforma sin elección, workers globales) no
 * toca nada y el comportamiento es el de siempre.
 */
export function tenancyExtension() {
  return {
    query: {
      $allModels: {
        $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => unknown;
        }) {
          const tenantId = currentTenantId();
          if (!tenantId || !model || !isTenantModel(model)) {
            return query(args);
          }
          return query(scopeArgs(model, operation, args as Record<string, unknown>, tenantId));
        },
      },
    },
  };
}

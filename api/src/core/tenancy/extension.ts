import { env } from "@core/config/env.config";
import { currentRlsBypass, currentTenantId, insideRlsTransaction } from "./context";
import { isTenantModel } from "./models";
import { scopeArgs } from "./scope";

/** Cliente base para abrir la transacción que fija `app.tenant_id` (RLS). */
export interface RlsExecutor {
  $transaction: (ops: unknown[]) => Promise<unknown[]>;
  $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<number>;
}

/** SQL que fija el cliente de la transacción en curso (RLS, F1B-01). */
export const SET_TENANT_SQL = "SELECT set_config('app.tenant_id', $1, true)";
/** SQL del bypass controlado para lookups pre-contexto (login/token de agente). */
export const SET_BYPASS_SQL = "SELECT set_config('app.bypass_rls', 'on', true)";

/**
 * Extensión de Prisma que aplica el aislamiento por cliente a TODAS las
 * operaciones de los modelos de tenant: nadie filtra `tenantId` a mano.
 * Sin contexto de cliente (plataforma sin elección, workers globales) no
 * toca nada y el comportamiento es el de siempre.
 *
 * Con RLS activo (`RLS_ENABLED=true`) cada operación de un modelo de tenant se
 * ejecuta en una transacción que primero fija `app.tenant_id`: si la extensión
 * fallara y no filtrara, Postgres seguiría sin devolver filas de otro cliente.
 * Dentro de una transacción tenant-aware (`tenantTransaction`) no se envuelve
 * otra vez: la variable ya está fijada en esa transacción.
 */
export function tenancyExtension(options: { rls?: { client: RlsExecutor } } = {}) {
  const rls = env.RLS_ENABLED ? options.rls : undefined;
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
          if (!model || !isTenantModel(model)) {
            return query(args);
          }
          // Lookup de sistema ANTES de conocer el cliente (login, token de
          // agente): la misma transacción fija `app.bypass_rls` para que la
          // política deje ver la fila. No se usa con datos del request.
          if (rls && currentRlsBypass() && !insideRlsTransaction()) {
            return (async () => {
              const [, result] = await rls.client.$transaction([
                rls.client.$executeRawUnsafe(SET_BYPASS_SQL),
                query(args),
              ]);
              return result;
            })();
          }
          if (!tenantId) {
            return query(args);
          }
          const scoped = scopeArgs(model, operation, args as Record<string, unknown>, tenantId);
          if (!rls || insideRlsTransaction()) {
            return query(scoped);
          }
          return (async () => {
            const [, result] = await rls.client.$transaction([
              rls.client.$executeRawUnsafe(SET_TENANT_SQL, tenantId),
              query(scoped),
            ]);
            return result;
          })();
        },
      },
    },
  };
}

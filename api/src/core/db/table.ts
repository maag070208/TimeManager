import { Prisma } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { decodeCursor, encodeCursor, type ITDataTableResponse } from "@core/utils/table";

type DelegateLike = {
  count: (args?: unknown) => Promise<number>;
  findMany: (args?: unknown) => Promise<unknown[]>;
};

export interface PaginatedQueryArgs<TModel = unknown, TRow = unknown> {
  model: TModel;
  where?: Record<string, unknown>;
  orderBy?: unknown[];
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
  page: number;
  limit: number;
  /**
   * Paginación por cursor (F4-02). `where` traduce el cursor decodificado a un
   * filtro keyset y `from` guarda del último renglón lo necesario para el
   * siguiente. Sin esta config, `params.cursor` se ignora (offset).
   */
  cursor?: {
    where: (value: unknown) => Record<string, unknown>;
    from: (row: TRow) => unknown;
    /** Cursor recibido del request (se decodifica aquí). */
    value?: string;
  };
}

/** COUNT + QUERY en una sola transacción (patrón compartido de tablas server-side). */
export const paginatedQuery = async <T, TModel = unknown>(
  args: PaginatedQueryArgs<TModel, T>
): Promise<ITDataTableResponse<T>> => {
  const { model: rawModel, where = {}, orderBy = [], select, include, page, limit, cursor } = args;
  const model = rawModel as unknown as DelegateLike;

  const decoded = cursor ? decodeCursor(cursor.value) : null;
  const cursorWhere = decoded !== null && cursor ? cursor.where(decoded) : undefined;
  const scopedWhere = cursorWhere ? { AND: [where, cursorWhere] } : where;

  const findManyArgs: Record<string, unknown> = {
    where: scopedWhere,
    orderBy,
    take: limit,
    ...(cursorWhere ? {} : { skip: (page - 1) * limit }),
  };
  if (select) findManyArgs.select = select;
  if (include) findManyArgs.include = include;

  // Con cursor no se paga el COUNT: el cliente que pagina por cursor no lo usa.
  if (cursorWhere) {
    const data = (await model.findMany(findManyArgs)) as T[];
    const last = data[data.length - 1];
    const nextCursor =
      cursor && last !== undefined && data.length === limit ? encodeCursor(cursor.from(last)) : null;
    return { data, total: 0, nextCursor };
  }

  const tx = [model.count({ where }), model.findMany(findManyArgs)] as unknown as [
    Prisma.PrismaPromise<number>,
    Prisma.PrismaPromise<unknown[]>
  ];
  const [total, rows] = await prismaClient.$transaction(tx);
  const data = rows as T[];
  // Aun en offset, si el endpoint soporta cursor se anuncia el de la última fila
  // para que el cliente pueda continuar por keyset (F4-02).
  const last = data[data.length - 1];
  const nextCursor =
    cursor && last !== undefined && data.length === limit ? encodeCursor(cursor.from(last)) : undefined;

  return { data, total, ...(nextCursor !== undefined ? { nextCursor } : {}) };
};
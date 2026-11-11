import { HttpError } from "@core/middlewares/error.middleware";
import type { RemotePunchDirection } from "../models/entity/nom.entity";

/**
 * Reglas de secuencia de la checada remota (F2-07), puras para poder probarlas
 * sin BD. Se calculan con el estado del día del cliente: la última checada de
 * hoy y el tipo que se intenta registrar.
 */

/** Tipos válidos como siguiente paso. `[]` = el día ya está cerrado. */
export const expectedNextTypes = (
  lastType: RemotePunchDirection | null,
  lastIsToday: boolean
): RemotePunchDirection[] => {
  if (!lastIsToday || lastType === null) return ["ENTRY"];
  switch (lastType) {
    case "ENTRY":
      return ["LUNCH_START", "EXIT"];
    case "LUNCH_START":
      return ["LUNCH_END"];
    case "LUNCH_END":
      return ["EXIT"];
    case "EXIT":
      return [];
  }
};

/**
 * Valida el paso y lanza el 409 que corresponde: `WORKDAY_ALREADY_CLOSED` si
 * hoy ya salió, `INVALID_PUNCH_SEQUENCE` con lo que sí se esperaba en otro caso.
 */
export const assertPunchSequence = (
  type: RemotePunchDirection,
  lastType: RemotePunchDirection | null,
  lastIsToday: boolean
): void => {
  if (lastIsToday && lastType === "EXIT") {
    throw new HttpError(409, "WORKDAY_ALREADY_CLOSED");
  }
  const expected = expectedNextTypes(lastType, lastIsToday);
  if (!expected.includes(type)) {
    throw new HttpError(409, "INVALID_PUNCH_SEQUENCE", { type, expected });
  }
};

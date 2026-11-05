import type { TFunction } from "i18next";

type LooseTranslate = (key: string, options?: Record<string, unknown>) => string;

export const dyn =
  (tt: TFunction<any>): LooseTranslate =>
  (key, options) =>
    (tt as LooseTranslate)(key, options);
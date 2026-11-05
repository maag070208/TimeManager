import { useCallback, useEffect, useState } from "react";
import { sysConfigApi, type SysConfig } from "@entities/sys-config";
import { i18n } from "@shared/i18n";

// Regex simple: cualquier cosa con forma user@dominio.tld (sin espacios).
// Es la misma validación que el frontend usa en otros lugares del sistema
// (registro de empleados, edición de perfil, etc.); no pretende ser RFC 5322
// estricto — solo rechazar basura obvia antes de pegarle a la BD.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida un solo correo (misma regla que usa el editor de destinatarios). */
export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email.trim());

export interface EmailValidationResult {
  valid: string[];
  invalid: string[];
}

export const parseEmailRecipients = (raw: string): EmailValidationResult => {
  const tokens = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const t of tokens) {
    if (EMAIL_REGEX.test(t)) {
      valid.push(t);
    } else {
      invalid.push(t);
    }
  }
  return { valid, invalid };
};

interface GetState {
  data: SysConfig | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export const useGetSysConfig = (key: string): GetState => {
  const [data, setData] = useState<SysConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sysConfigApi.get(key);
      setData(result);
    } catch (err) {
      const message =
        (err as { message?: string })?.message ?? i18n.t("common:errors.load");
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
};

interface MutateState {
  mutate: (value: string) => Promise<SysConfig>;
  loading: boolean;
  error: string | null;
}

export const useUpdateSysConfig = (key: string): MutateState => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (value: string) => {
      setLoading(true);
      setError(null);
      try {
        return await sysConfigApi.update(key, value);
      } catch (err) {
        const message =
          (err as { message?: string })?.message ?? i18n.t("common:errors.save");
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [key]
  );

  return { mutate, loading, error };
};
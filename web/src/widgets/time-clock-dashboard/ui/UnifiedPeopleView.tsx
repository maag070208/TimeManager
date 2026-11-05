import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheck, FaSyncAlt } from "react-icons/fa";
import { ITAlert, ITButton, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { timeClockApi, type UnifiedPeople } from "@entities/time-clock";

/** Personas de todos los relojes en una sola tabla: una columna por reloj, solo lectura. */
export default function UnifiedPeopleView() {
  const { t } = useTranslation("time-clock");
  const [data, setData] = useState<UnifiedPeople | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    timeClockApi
      .peopleUnified()
      .then(setData)
      .catch((e: any) => setError(e?.message ?? t("dashboard.unified.empty")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data?.people ?? [];
    return q ? all.filter((p) => p.employeeNumber.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : all;
  }, [data, query]);

  return (
    <ITFlex direction="column" gap={4}>
      <ITFlex align="center" justify="between" gap={3} wrap="wrap">
        <ITText className="text-sm text-slate-500">{t("dashboard.unified.hint")}</ITText>
        <ITButton variant="outlined" color="secondary" size="sm" disabled={loading} onClick={load}>
          <ITFlex align="center" gap={2}>
            <FaSyncAlt size={11} className={loading ? "animate-spin" : ""} />
            {t("dashboard.unified.refresh")}
          </ITFlex>
        </ITButton>
      </ITFlex>

      {error && <ITAlert variant="error">{error}</ITAlert>}
      {data?.clocks.filter((c) => c.error).map((c) => (
        <ITAlert key={c.serial} variant="warning">
          {t("dashboard.unified.clockError", { clock: c.name, code: c.error })}
        </ITAlert>
      ))}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("dashboard.unified.search")}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400"
      />

      {loading && !data && <ITText className="text-sm text-slate-400">{t("dashboard.loading")}</ITText>}

      {data && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("dashboard.unified.number")}</th>
                <th className="px-4 py-3">{t("dashboard.unified.name")}</th>
                {data.clocks.map((c) => (
                  <th key={c.serial} className="px-4 py-3 text-center">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.employeeNumber} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono">{p.employeeNumber}</td>
                  <td className="px-4 py-2">{p.name}</td>
                  {data.clocks.map((c) => (
                    <td key={c.serial} className="px-4 py-2 text-center">
                      {p.presentIn.includes(c.serial) ? <FaCheck className="inline text-emerald-600" /> : <span className="text-slate-300">{t("dashboard.unified.none")}</span>}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={2 + data.clocks.length} className="px-4 py-8 text-center text-slate-400">
                    {t("dashboard.unified.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </ITFlex>
  );
}

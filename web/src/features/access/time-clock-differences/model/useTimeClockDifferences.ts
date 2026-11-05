import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { timeClockApi, type TimeClockEmployee } from "@entities/time-clock";
import { usersApi, useCan, type User } from "@entities/user";

/** Compara sin acentos ni mayúsculas: el nombre del reloj viene en mayúsculas. */
const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Renglones por página al traer la lista completa (el contrato topa en 200). */
const PAGE = 200;

/**
 * Conciliación de los números del reloj con las personas del sistema: las dos
 * listas completas, los conteos de lo que falta, y asignar/desvincular con dos
 * clics (uno de cada lado). Nada se escribe hasta que se confirma.
 */
export const useTimeClockDifferences = () => {
  const { t } = useTranslation(["time-clock", "common"]);
  // Mismo permiso que PUT/DELETE /time-clock/employees en la API.
  const canLink = useCan("time_clock.link");

  const [clock, setClock] = useState<TimeClockEmployee[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [qClock, setQClock] = useState("");
  const [qPerson, setQPerson] = useState("");
  /** Izquierda: por omisión solo lo que falta por vincular (las diferencias). */
  const [onlyMissing, setOnlyMissing] = useState(true);
  /** Derecha: por omisión solo quien no tiene número en el reloj. */
  const [onlyFree, setOnlyFree] = useState(true);

  const [clockSel, setClockSel] = useState<TimeClockEmployee | null>(null);
  const [personSel, setPersonSel] = useState<User | null>(null);

  /**
   * Las dos listas completas de un jalón: la pantalla concilia, así que necesita
   * poder contar y buscar sin ir al servidor en cada tecla (son unos cientos de
   * renglones, no miles).
   */
  const cargar = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const filas: TimeClockEmployee[] = [];
      for (let page = 1; ; page++) {
        const res = await timeClockApi.employees({ page, limit: PAGE, filters: {} });
        filas.push(...res.data);
        if (res.data.length === 0 || filas.length >= res.total) break;
      }
      setClock(filas);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("differences.errors.load"));
    }
    try {
      setPeople(await usersApi.employees());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("differences.errors.people"));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /**
   * A qué números del reloj está asignada cada persona. El esquema lo permite
   * (una persona con dos tarjetas), así que la pantalla lo AVISA en vez de
   * impedirlo.
   */
  const asignados = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const r of clock) {
      if (!r.link) continue;
      mapa.set(r.link.userId, [...(mapa.get(r.link.userId) ?? []), r.employeeNumber]);
    }
    return mapa;
  }, [clock]);

  const missing = useMemo(() => clock.filter((r) => !r.link).length, [clock]);
  const free = useMemo(() => people.filter((p) => !asignados.has(p.id)).length, [people, asignados]);

  const contains = (texto: string, q: string): boolean => !q || norm(texto).includes(norm(q));

  const clockVisible = useMemo(() => {
    const q = qClock.trim();
    return clock
      .filter((r) => (!onlyMissing || !r.link) && contains(`${r.employeeNumber} ${r.name}`, q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clock, onlyMissing, qClock]);

  const peopleVisible = useMemo(() => {
    const q = qPerson.trim();
    return people
      .filter(
        (p) => (!onlyFree || !asignados.has(p.id)) && contains(`${p.name} ${p.employeeNumber ?? ""}`, q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [people, onlyFree, asignados, qPerson]);

  const cancelar = useCallback(() => {
    setClockSel(null);
    setPersonSel(null);
  }, []);

  /** `PUT /time-clock/employees/:numero`: asigna (o cambia) el vínculo. */
  const asignar = useCallback(async () => {
    if (!clockSel || !personSel) return;
    setSaving(true);
    setError(null);
    try {
      const res = await timeClockApi.linkEmployee(clockSel.employeeNumber, personSel.id);
      setToast(
        t("differences.toasts.linked", {
          number: clockSel.employeeNumber,
          name: res.link?.name ?? personSel.name,
        })
      );
      cancelar();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("differences.errors.save"));
    } finally {
      setSaving(false);
    }
  }, [clockSel, personSel, t, cancelar, cargar]);

  const desvincular = useCallback(async () => {
    if (!clockSel?.link) return;
    setSaving(true);
    setError(null);
    try {
      await timeClockApi.unlinkEmployee(clockSel.employeeNumber);
      setToast(t("differences.toasts.unlinked", { number: clockSel.employeeNumber }));
      cancelar();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("differences.errors.save"));
    } finally {
      setSaving(false);
    }
  }, [clockSel, t, cancelar, cargar]);

  return {
    t,
    canLink,
    loading,
    saving,
    error,
    setError,
    toast,
    setToast,
    qClock,
    setQClock,
    qPerson,
    setQPerson,
    onlyMissing,
    setOnlyMissing,
    onlyFree,
    setOnlyFree,
    clockVisible,
    peopleVisible,
    missing,
    free,
    /** Persona → números del reloj en los que está (vacío si no tiene ninguno). */
    asignados,
    /** Números en los que ya está la persona elegida (para avisar antes de asignar). */
    yaAsignadaA: personSel ? (asignados.get(personSel.id) ?? []) : [],
    clockSel,
    setClockSel,
    personSel,
    setPersonSel,
    cancelar,
    asignar,
    desvincular,
  };
};

export type UseTimeClockDifferences = ReturnType<typeof useTimeClockDifferences>;

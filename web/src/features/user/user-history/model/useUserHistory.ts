import { useEffect, useState } from "react";
import { usersApi, type User } from "@entities/user";
import type { HistoryEntry } from "./types";

export const useUserHistory = (id?: string) => {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([usersApi.get(id), usersApi.history(id)])
      .then(([u, h]) => {
        setUser(u);
        setHistory(h);
      })
      .catch(() => {
        setUser(null);
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return { user, history, loading };
};
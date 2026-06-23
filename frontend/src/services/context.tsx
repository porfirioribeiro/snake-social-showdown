import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { backendApi, type Api } from "./api";
import type { User } from "./types";

interface ServicesContextValue {
  api: Api;
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const ServicesContext = createContext<ServicesContextValue | null>(null);

export function ServicesProvider({ children, api = backendApi }: { children: ReactNode; api?: Api }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const u = await api.getCurrentUser();
    setUser(u);
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    api
      .getCurrentUser()
      .then((u) => {
        if (!cancelled) {
          setUser(u);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <ServicesContext.Provider value={{ api, user, loading, refreshUser }}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices() {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error("useServices must be used within ServicesProvider");
  return ctx;
}

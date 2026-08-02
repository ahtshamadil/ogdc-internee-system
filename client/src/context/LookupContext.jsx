import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const LookupContext = createContext(null);

const EMPTY = { universities: [], degrees: [], departments: [], cities: [], supervisors: [] };

/**
 * Universities, degrees, departments, cities and supervisors are needed by the
 * form, the filter bar and the import preview all at once. They change rarely,
 * so they are fetched once per session and refreshed on demand after an admin
 * edits them.
 */
export function LookupProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await api.get('/lookups'));
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fast id -> name maps for rendering table cells and chips.
  const maps = useMemo(() => {
    const build = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.name]));
    return {
      universities: build(data.universities),
      degrees: build(data.degrees),
      departments: build(data.departments),
      cities: build(data.cities),
      supervisors: build(data.supervisors),
    };
  }, [data]);

  return (
    <LookupContext.Provider value={{ ...data, maps, loading, refresh }}>
      {children}
    </LookupContext.Provider>
  );
}

export const useLookups = () => {
  const ctx = useContext(LookupContext);
  if (!ctx) throw new Error('useLookups must be used inside LookupProvider');
  return ctx;
};

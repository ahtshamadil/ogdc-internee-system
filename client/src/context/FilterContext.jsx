import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const FilterContext = createContext(null);

export const EMPTY_FILTERS = {
  search: '',
  university_id: '',
  degree_id: '',
  department_id: '',
  city_id: '',
  status: '',
  gender: '',
  from: '',
  to: '',
  certificate: '',
};

/**
 * One filter set shared by the dashboard, the intern list and reports.
 *
 * Keeping it in context rather than per-page means a manager who filters the
 * dashboard to one department and then opens the intern list sees the same
 * population, instead of silently switching back to everyone.
 */
export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [likeForLike, setLikeForLike] = useState(true);

  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const clearFilter = useCallback((key) => {
    setFilters((f) => ({ ...f, [key]: EMPTY_FILTERS[key] }));
  }, []);

  const activeCount = useMemo(
    () => Object.entries(filters).filter(([k, v]) => v !== EMPTY_FILTERS[k] && v !== '').length,
    [filters],
  );

  // Only non-empty values reach the query string, so URLs and cache keys stay tidy.
  const params = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null)),
    [filters],
  );

  return (
    <FilterContext.Provider
      value={{ filters, params, setFilter, setFilters, reset, clearFilter, activeCount, likeForLike, setLikeForLike }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside FilterProvider');
  return ctx;
};

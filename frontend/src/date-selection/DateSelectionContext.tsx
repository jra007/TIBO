import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '../api/client';

const STORAGE_KEY = 'tibo.selectedDate';

interface DateSelectionContextValue {
  /** The app-wide "as of" date, "YYYY-MM-DD" — null while the default is still loading. */
  selectedDate: string | null;
  setSelectedDate: (date: string) => void;
}

const DateSelectionContext = createContext<DateSelectionContextValue | undefined>(undefined);

/**
 * The global date selector's state (addendum: TIBO_addendum_doublons_et_dates.md, point 4) — every
 * view implicitly filters to this date unless it has its own explicit date_ingestion filter. Once
 * the user picks a date it's remembered (localStorage) across reloads/navigation; until they do,
 * it defaults to the most recent day anything was actually ingested (GET /ingestion/latest-date),
 * not just today's calendar date, which could have zero data.
 */
export function DateSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (selectedDate) return;
    apiClient
      .get<{ date: string | null }>('/ingestion/latest-date')
      .then((result) => {
        if (result.date) setSelectedDateState(result.date);
      })
      .catch(() => {
        // No data ingested yet, or the request failed — views fall back per-table on the backend anyway.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setSelectedDate(date: string) {
    localStorage.setItem(STORAGE_KEY, date);
    setSelectedDateState(date);
  }

  return <DateSelectionContext.Provider value={{ selectedDate, setSelectedDate }}>{children}</DateSelectionContext.Provider>;
}

export function useDateSelection(): DateSelectionContextValue {
  const ctx = useContext(DateSelectionContext);
  if (!ctx) throw new Error('useDateSelection must be used within DateSelectionProvider');
  return ctx;
}

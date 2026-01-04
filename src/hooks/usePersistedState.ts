import { useState, useEffect, useCallback } from 'react';

export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving to sessionStorage', e);
    }
  }, [key, state]);

  const clearState = useCallback(() => {
    sessionStorage.removeItem(key);
    setState(defaultValue);
  }, [key, defaultValue]);

  return [state, setState, clearState];
}

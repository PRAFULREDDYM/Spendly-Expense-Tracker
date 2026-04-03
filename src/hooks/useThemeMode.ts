import { useEffect, useState } from 'react';
import type { ThemeMode } from '../types';
import {
  applyResolvedTheme,
  getStoredThemePreference,
  resolveThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
  type ResolvedTheme,
} from '../lib/theme';

export function useThemeMode() {
  const [preference, setPreferenceState] = useState<ThemeMode>(() => getStoredThemePreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveThemePreference(getStoredThemePreference()));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      const nextTheme = resolveThemePreference(preference);
      setResolvedTheme(nextTheme);
      applyResolvedTheme(nextTheme);
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const nextTheme = preference === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : preference;
      setResolvedTheme(nextTheme);
      applyResolvedTheme(nextTheme);
    };

    applyTheme();

    if (preference !== 'system') {
      return undefined;
    }

    const handleChange = () => applyTheme();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preference]);

  const setPreference = (nextPreference: ThemeMode) => {
    setPreferenceState(nextPreference);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextPreference);
    }
  };

  const toggleTheme = () => {
    setPreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return {
    preference,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    setPreference,
    toggleTheme,
  };
}

import type { ThemeMode } from '../types';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCE_STORAGE_KEY = 'theme-preference';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function getStoredThemePreference() {
  if (typeof window === 'undefined') {
    return 'system' as ThemeMode;
  }

  const value = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
  return isThemeMode(value) ? value : 'system';
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveThemePreference(preference: ThemeMode): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (document.body) {
    document.body.dataset.theme = theme;
    document.body.style.colorScheme = theme;
  }
}

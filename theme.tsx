import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@app_theme_preference';
const PRESET_STORAGE_KEY = '@app_theme_preset';

export interface Colors {
  bg: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  // Semantic colors (same in both modes)
  success: string;
  error: string;
  warning: string;
  errorLight: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  accent: string;
  dark: Colors;
  light: Colors;
}

const SEMANTIC = {
  success: '#34C759',
  error: '#F87171',
  warning: '#FF9500',
  errorLight: 'rgba(239, 68, 68, 0.1)',
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    accent: '#007AFF',
    dark: {
      bg: '#0F172A', card: '#1E293B', border: '#334155',
      text: '#F1F5F9', textSecondary: '#94A3B8', textMuted: '#64748B',
      accent: '#007AFF', ...SEMANTIC,
    },
    light: {
      bg: '#fafafa', card: '#FFFFFF', border: '#E2E8F0',
      text: '#0F172A', textSecondary: '#64748B', textMuted: '#94A3B8',
      accent: '#007AFF', ...SEMANTIC,
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    accent: '#818CF8',
    dark: {
      bg: '#0B0F1A', card: '#151B2E', border: '#2A3152',
      text: '#E8E8FF', textSecondary: '#9B9BC0', textMuted: '#6B6B8D',
      accent: '#818CF8', ...SEMANTIC,
    },
    light: {
      bg: '#F5F5FF', card: '#FFFFFF', border: '#DDD8F0',
      text: '#1A1A3E', textSecondary: '#6B6B8D', textMuted: '#9B9BC0',
      accent: '#818CF8', ...SEMANTIC,
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    accent: '#06B6D4',
    dark: {
      bg: '#0A1628', card: '#112240', border: '#1E3A5F',
      text: '#E0F2FE', textSecondary: '#7DD3FC', textMuted: '#4A90A4',
      accent: '#06B6D4', ...SEMANTIC,
    },
    light: {
      bg: '#F0FDFA', card: '#FFFFFF', border: '#C4E8E0',
      text: '#0A1628', textSecondary: '#4A90A4', textMuted: '#7DA8B8',
      accent: '#06B6D4', ...SEMANTIC,
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    accent: '#22C55E',
    dark: {
      bg: '#0A1A0F', card: '#132A1A', border: '#1F3D28',
      text: '#ECFDF5', textSecondary: '#86EFAC', textMuted: '#4A8C62',
      accent: '#22C55E', ...SEMANTIC,
    },
    light: {
      bg: '#F0FDF4', card: '#FFFFFF', border: '#C6E7D0',
      text: '#0A1A0F', textSecondary: '#4A8C62', textMuted: '#7BAA8E',
      accent: '#22C55E', ...SEMANTIC,
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    accent: '#F97316',
    dark: {
      bg: '#1A0F0A', card: '#2A1810', border: '#3D2A1F',
      text: '#FFF7ED', textSecondary: '#FDBA74', textMuted: '#9A7360',
      accent: '#F97316', ...SEMANTIC,
    },
    light: {
      bg: '#FFF7ED', card: '#FFFFFF', border: '#E8D5C4',
      text: '#1A0F0A', textSecondary: '#9A7360', textMuted: '#B89880',
      accent: '#F97316', ...SEMANTIC,
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    accent: '#F43F5E',
    dark: {
      bg: '#1A0A10', card: '#2A1018', border: '#3D1A28',
      text: '#FFF1F2', textSecondary: '#FDA4AF', textMuted: '#9A6070',
      accent: '#F43F5E', ...SEMANTIC,
    },
    light: {
      bg: '#FFF1F2', card: '#FFFFFF', border: '#E8C4CC',
      text: '#1A0A10', textSecondary: '#9A6070', textMuted: '#B88090',
      accent: '#F43F5E', ...SEMANTIC,
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    accent: '#A78BFA',
    dark: {
      bg: '#110E1A', card: '#1C1828', border: '#302A45',
      text: '#F0EAFF', textSecondary: '#C4B5FD', textMuted: '#7C6FA0',
      accent: '#A78BFA', ...SEMANTIC,
    },
    light: {
      bg: '#F5F3FF', card: '#FFFFFF', border: '#DDD6FE',
      text: '#1E1B3A', textSecondary: '#7C6FA0', textMuted: '#A09ABC',
      accent: '#A78BFA', ...SEMANTIC,
    },
  },
  {
    id: 'cherry',
    name: 'Cherry',
    accent: '#DC2626',
    dark: {
      bg: '#1A0A0A', card: '#2A1010', border: '#3D1A1A',
      text: '#FEF2F2', textSecondary: '#FCA5A5', textMuted: '#9A6060',
      accent: '#DC2626', ...SEMANTIC,
    },
    light: {
      bg: '#FEF2F2', card: '#FFFFFF', border: '#FECACA',
      text: '#1A0A0A', textSecondary: '#9A6060', textMuted: '#B88080',
      accent: '#DC2626', ...SEMANTIC,
    },
  },
  {
    id: 'gold',
    name: 'Gold',
    accent: '#D97706',
    dark: {
      bg: '#1A150A', card: '#2A2010', border: '#3D321F',
      text: '#FFFBEB', textSecondary: '#FCD34D', textMuted: '#9A8560',
      accent: '#D97706', ...SEMANTIC,
    },
    light: {
      bg: '#FFFBEB', card: '#FFFFFF', border: '#FDE68A',
      text: '#1A150A', textSecondary: '#92700C', textMuted: '#B89E50',
      accent: '#D97706', ...SEMANTIC,
    },
  },
];

export type ThemeMode = 'light' | 'dark' | 'night';

interface ThemeContextType {
  colors: Colors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  themeId: string;
  setThemeId: (id: string) => void;
  presets: ThemePreset[];
}

const ThemeContext = createContext<ThemeContextType>({
  colors: THEME_PRESETS[0].dark,
  isDark: true,
  mode: 'dark',
  setMode: () => {},
  toggle: () => {},
  themeId: 'default',
  setThemeId: () => {},
  presets: THEME_PRESETS,
});

export const useTheme = () => useContext(ThemeContext);

const getNightColors = (dark: Colors): Colors => ({
  ...dark,
  bg: '#000000',
  card: '#0C0C0C',
  border: '#1A1A1A',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [themeId, setThemeIdState] = useState('default');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_STORAGE_KEY),
      AsyncStorage.getItem(PRESET_STORAGE_KEY),
    ]).then(([storedMode, storedPreset]) => {
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'night') {
        setModeState(storedMode);
      }
      if (storedPreset && THEME_PRESETS.some(p => p.id === storedPreset)) {
        setThemeIdState(storedPreset);
      }
    });
  }, []);

  const isDark = mode !== 'light';

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_STORAGE_KEY, m);
  }, []);

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    AsyncStorage.setItem(PRESET_STORAGE_KEY, id);
  }, []);

  const preset = THEME_PRESETS.find(p => p.id === themeId) || THEME_PRESETS[0];
  const colors = mode === 'night' ? getNightColors(preset.dark) : mode === 'dark' ? preset.dark : preset.light;

  const value = useMemo(
    () => ({ colors, isDark, mode, setMode, toggle, themeId, setThemeId, presets: THEME_PRESETS }),
    [colors, isDark, mode, setMode, toggle, themeId, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

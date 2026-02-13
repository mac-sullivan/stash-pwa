export const PRESET_CATEGORIES = [
  'Restaurant', 'Retail', 'Service', 'Health', 'Tech',
  'Finance', 'Creative', 'Education', 'Real Estate', 'Other',
];

export type ThemeName = 'light' | 'dark' | 'bold';

export interface ThemeColors {
  bg: string;
  bgCard: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentHover: string;
  inputBg: string;
  inputBorder: string;
  headerBg: string;
  headerText: string;
}

export const themes: Record<ThemeName, ThemeColors> = {
  light: {
    bg: '#f8fafc',
    bgCard: '#ffffff',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    inputBg: '#ffffff',
    inputBorder: '#cbd5e1',
    headerBg: '#ffffff',
    headerText: '#0f172a',
  },
  dark: {
    bg: '#0f0f14',
    bgCard: '#1e1e28',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    border: '#2a2a3a',
    accent: '#818cf8',
    accentHover: '#6366f1',
    inputBg: '#16161e',
    inputBorder: '#2a2a3a',
    headerBg: '#1e1e28',
    headerText: '#f1f5f9',
  },
  bold: {
    bg: '#7c3aed',
    bgCard: '#ffffff',
    text: '#1e1b4b',
    textMuted: '#6366f1',
    border: '#e0d4fc',
    accent: '#7c3aed',
    accentHover: '#6d28d9',
    inputBg: '#ffffff',
    inputBorder: '#c4b5fd',
    headerBg: '#6d28d9',
    headerText: '#ffffff',
  },
};

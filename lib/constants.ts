export const PRESET_CATEGORIES = [
  'Restaurant', 'Retail', 'Service', 'Health', 'Tech',
  'Finance', 'Creative', 'Education', 'Real Estate', 'Other',
];

export type ThemeName = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgCard: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentHover: string;
  link: string;
  inputBg: string;
  inputBorder: string;
  headerBg: string;
  headerText: string;
  cardShadow: string;
}

export const cardShadow = (color: string) => ({
  boxShadow: `0px 2px 8px ${color}`,
});

export const cardShadowLg = (color: string) => ({
  boxShadow: `0px 4px 16px ${color}`,
});

export type FontSizeName = 'small' | 'medium' | 'large';

export type FontStyleName = 'sans-serif' | 'serif' | 'retro';

export interface FontSizes {
  xs: number;
  sm: number;
  base: number;
  lg: number;
  xl: number;
}

export const FONT_SIZES: Record<FontSizeName, FontSizes> = {
  small: { xs: 10, sm: 12, base: 13, lg: 15, xl: 16 },
  medium: { xs: 12, sm: 14, base: 15, lg: 17, xl: 19 },
  large: { xs: 14, sm: 16, base: 18, lg: 20, xl: 22 },
};

export const themes: Record<ThemeName, ThemeColors> = {
  light: {
    bg: '#f5f5f7',
    bgCard: '#f7f7f7',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    accent: '#59552C',
    accentHover: '#47431F',
    link: '#59552C',
    inputBg: '#f0f1f3',
    inputBorder: '#cbd5e1',
    headerBg: '#f7f7f7',
    headerText: '#0f172a',
    cardShadow: 'rgba(0,0,0,0.08)',
  },
  dark: {
    bg: '#0f0f14',
    bgCard: '#1e1e28',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    border: '#2a2a3a',
    accent: '#7E3489',
    accentHover: '#65296E',
    link: '#A78BFA',
    inputBg: '#16161e',
    inputBorder: '#2a2a3a',
    headerBg: '#1e1e28',
    headerText: '#f1f5f9',
    cardShadow: 'rgba(0,0,0,0.3)',
  },
};

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, FONT_SIZES, type ThemeName, type ThemeColors, type FontSizeName, type FontSizes, type FontStyleName } from './constants';

function getFontFamily(style: FontStyleName): string | undefined {
  switch (style) {
    case 'serif':
      return Platform.select({ ios: 'Georgia', default: 'serif' });
    case 'retro':
      return 'SpaceMono-Regular';
    default:
      return undefined;
  }
}

interface ThemeContextType {
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
  fontSize: FontSizeName;
  fontSizes: FontSizes;
  setFontSize: (size: FontSizeName) => void;
  fontStyle: FontStyleName;
  fontFamily: string | undefined;
  setFontStyle: (style: FontStyleName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  colors: themes.light,
  setTheme: () => {},
  fontSize: 'medium',
  fontSizes: FONT_SIZES.medium,
  setFontSize: () => {},
  fontStyle: 'sans-serif',
  fontFamily: undefined,
  setFontStyle: () => {},
});

const THEME_KEY = 'stash-theme';
const FONT_SIZE_KEY = 'stash-font-size';
const FONT_STYLE_KEY = 'stash-font-style';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('light');
  const [fontSize, setFontSizeState] = useState<FontSizeName>('medium');
  const [fontStyle, setFontStyleState] = useState<FontStyleName>('sans-serif');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      AsyncStorage.getItem(FONT_SIZE_KEY),
      AsyncStorage.getItem(FONT_STYLE_KEY),
    ]).then(([storedTheme, storedFontSize, storedFontStyle]) => {
      if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark')) {
        setThemeState(storedTheme);
      }
      if (storedFontSize && (storedFontSize === 'small' || storedFontSize === 'medium' || storedFontSize === 'large')) {
        setFontSizeState(storedFontSize);
      }
      if (storedFontStyle && (storedFontStyle === 'sans-serif' || storedFontStyle === 'serif' || storedFontStyle === 'retro')) {
        setFontStyleState(storedFontStyle);
      }
    });
  }, []);

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
    AsyncStorage.setItem(THEME_KEY, newTheme);
  }, []);

  const setFontSize = useCallback((newSize: FontSizeName) => {
    setFontSizeState(newSize);
    AsyncStorage.setItem(FONT_SIZE_KEY, newSize);
  }, []);

  const setFontStyle = useCallback((newStyle: FontStyleName) => {
    setFontStyleState(newStyle);
    AsyncStorage.setItem(FONT_STYLE_KEY, newStyle);
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme,
      colors: themes[theme],
      setTheme,
      fontSize,
      fontSizes: FONT_SIZES[fontSize],
      setFontSize,
      fontStyle,
      fontFamily: getFontFamily(fontStyle),
      setFontStyle,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

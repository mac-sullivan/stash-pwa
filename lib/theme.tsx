import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, FONT_SIZES, type ThemeName, type ThemeColors, type FontSizeName, type FontSizes } from './constants';

interface ThemeContextType {
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
  fontSize: FontSizeName;
  fontSizes: FontSizes;
  setFontSize: (size: FontSizeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  colors: themes.dark,
  setTheme: () => {},
  fontSize: 'medium',
  fontSizes: FONT_SIZES.medium,
  setFontSize: () => {},
});

const THEME_KEY = 'stash-theme';
const FONT_SIZE_KEY = 'stash-font-size';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('dark');
  const [fontSize, setFontSizeState] = useState<FontSizeName>('medium');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      AsyncStorage.getItem(FONT_SIZE_KEY),
    ]).then(([storedTheme, storedFontSize]) => {
      if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark')) {
        setThemeState(storedTheme);
      }
      if (storedFontSize && (storedFontSize === 'small' || storedFontSize === 'medium' || storedFontSize === 'large')) {
        setFontSizeState(storedFontSize);
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

  return (
    <ThemeContext.Provider value={{
      theme,
      colors: themes[theme],
      setTheme,
      fontSize,
      fontSizes: FONT_SIZES[fontSize],
      setFontSize,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

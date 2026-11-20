import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, ThemeColors } from '../constants/colors';
import { useApp } from './AppContext';

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  theme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType>({
  colors: Colors.light,
  isDark: false,
  theme: 'light',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const { settings } = useApp();

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && systemColorScheme === 'dark');

  const theme = isDark ? 'dark' : 'light';
  const colors = Colors[theme];

  return (
    <ThemeContext.Provider value={{ colors, isDark, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);


'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes';

// Wrap next-themes to preserve the existing useTheme API
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme="light" 
      enableSystem={false}
      themes={['light', 'dark', 'tokyo-night', 'solarized', 'abyss']}
    >
      {children}
    </NextThemesProvider>
  );
}

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  
  // Legacy toggle function mapping
  const toggleTheme = () => {
    const currentTheme = theme || resolvedTheme || 'light';
    const isDark = ['dark', 'tokyo-night', 'abyss'].includes(currentTheme);
    setTheme(isDark ? 'light' : 'dark');
  };

  return {
    theme: theme || resolvedTheme || 'light',
    setTheme,
    toggleTheme
  };
}

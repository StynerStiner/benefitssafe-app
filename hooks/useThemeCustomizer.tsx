'use client';

import { createContext, useContext, useState, ReactNode, JSX } from 'react';

interface ThemeCustomizerContextType {
  customizationOpen: boolean;
  setCustomizationOpen: (open: boolean) => void;
}

const ThemeCustomizerContext = createContext<ThemeCustomizerContextType | undefined>(undefined);

export function ThemeCustomizerProvider({ children }: { children: ReactNode }): JSX.Element {
  const [customizationOpen, setCustomizationOpen] = useState(false);

  return (
    <ThemeCustomizerContext.Provider value={{ customizationOpen, setCustomizationOpen }}>
      {children}
    </ThemeCustomizerContext.Provider>
  );
}

export function useThemeCustomizer() {
  const context = useContext(ThemeCustomizerContext);
  if (context === undefined) {
    throw new Error('useThemeCustomizer must be used within ThemeCustomizerProvider');
  }
  return context;
}

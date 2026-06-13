'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContextProvider';
import { Palette, ChevronDown } from 'lucide-react';

const themes = [
  { value: 'light', label: 'Light Modern', type: 'light' },
  { value: 'solarized', label: 'Solarized Light', type: 'light' },
  { value: 'dark', label: 'Dark Modern', type: 'dark' },
  { value: 'tokyo-night', label: 'Tokyo Night', type: 'dark' },
  { value: 'abyss', label: 'Abyss', type: 'dark' },
];

export default function HeaderThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative group flex items-center">
      <div className="absolute left-3 pointer-events-none text-slate-400 group-hover:text-primary transition-colors">
        <Palette className="w-3.5 h-3.5" />
      </div>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="appearance-none h-9 bg-surface-solid hover:bg-surface-hover border border-transparent hover:border-slate-200 dark:hover:border-white/10 text-[11px] font-semibold text-text-primary rounded-xl pl-9 pr-8 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all"
      >
        <optgroup label="Light Themes" className="bg-white dark:bg-[#121214] text-text-primary">
          {themes.filter(t => t.type === 'light').map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </optgroup>
        <optgroup label="Dark Themes" className="bg-white dark:bg-[#121214] text-text-primary">
          {themes.filter(t => t.type === 'dark').map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </optgroup>
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <ChevronDown className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

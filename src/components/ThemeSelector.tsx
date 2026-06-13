'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContextProvider';
import { Palette, ChevronDown } from 'lucide-react';

const themes = [
  { value: 'light', label: 'Default Light Modern', type: 'light' },
  { value: 'solarized', label: 'Solarized Light', type: 'light' },
  { value: 'dark', label: 'Default Dark Modern', type: 'dark' },
  { value: 'tokyo-night', label: 'Tokyo Night Light', type: 'dark' }, // Using "Light" suffix jokingly or correctly per VS Code if they want
  { value: 'abyss', label: 'Abyss', type: 'dark' },
];

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-1 mt-4 pt-4 border-t border-slate-200/50 dark:border-white/5">
      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
        <Palette className="w-3 h-3" />
        Color Theme
      </label>
      <div className="relative group">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="appearance-none w-full h-10 bg-white/45 dark:bg-black/20 border border-slate-200/50 hover:border-primary/50 dark:border-white/5 dark:hover:border-primary/50 text-xs text-text-primary rounded-xl px-3.5 pr-8 focus:outline-none focus:ring-4 focus:ring-primary/10 cursor-pointer shadow-sm transition-all"
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
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-primary transition-colors">
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Zap, Rocket, Globe, Gem, Check, Cpu } from 'lucide-react';

const STATIC_OPENROUTER_MODELS = [
  { id: 'google/gemini-1.5-flash:free', name: 'Gemini 1.5 Flash (Free)', category: 'free' },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', category: 'premium' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', category: 'free' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B Instruct (Free)', category: 'free' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', category: 'free' },
  { id: 'openchat/openchat-7b:free', name: 'OpenChat 7B (Free)', category: 'free' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Reasoning)', category: 'reasoning' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free / Reasoning)', category: 'reasoning' },
  { id: 'openai/o1-mini', name: 'OpenAI o1 Mini', category: 'reasoning' },
  { id: 'openai/o3-mini', name: 'OpenAI o3 Mini', category: 'reasoning' },
  { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3 (Free)', category: 'otherFree' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B Instruct (Free)', category: 'otherFree' },
  { id: 'microsoft/phi-3-medium-128k-instruct:free', name: 'Phi 3 Medium (Free)', category: 'otherFree' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', category: 'premium' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', category: 'premium' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', category: 'premium' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', category: 'premium' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', category: 'premium' },
];

const STATIC_GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', category: 'groq' },
  { id: 'llama-3.3-70b-specdec', name: 'Llama 3.3 70B Specdec', category: 'groq' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Llama 70B (Reasoning)', category: 'reasoning' },
  { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Qwen 32B (Reasoning)', category: 'reasoning' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', category: 'free' },
  { id: 'llama3-70b-8192', name: 'Llama 3 70B', category: 'otherFree' },
  { id: 'llama3-8b-8192', name: 'Llama 3 8B', category: 'free' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', category: 'otherFree' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', category: 'otherFree' },
];

const STATIC_GEMINI_MODELS = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', category: 'free' },
  { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', category: 'free' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', category: 'premium' },
];

const STATIC_OPENAI_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', category: 'free' },
  { id: 'gpt-4o', name: 'GPT-4o', category: 'premium' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', category: 'premium' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', category: 'free' },
  { id: 'o1-mini', name: 'o1 Mini (Reasoning)', category: 'reasoning' },
  { id: 'o1-preview', name: 'o1 Preview (Reasoning)', category: 'reasoning' },
  { id: 'o3-mini', name: 'o3 Mini (Reasoning)', category: 'reasoning' },
];

type Provider = 'openrouter' | 'groq' | 'gemini' | 'openai';

const PROVIDER_LABELS: Record<Provider, string> = {
  openrouter: 'OpenRouter Active Engine',
  groq: 'Groq Active Engine',
  gemini: 'Google Gemini Model',
  openai: 'OpenAI Model',
};

const PROVIDER_DEFAULTS: Record<Provider, string> = {
  openrouter: 'google/gemini-1.5-flash',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
};

export default function CustomModelSelector({
  value,
  onChange,
  apiKey,
  provider
}: {
  value: string;
  onChange: (val: string) => void;
  apiKey: string;
  provider: Provider;
}) {
  const [search, setSearch] = useState('');
  const [liveModels, setLiveModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    groq: provider === 'groq',
    free: true,
    reasoning: provider === 'openrouter' || provider === 'groq',
    otherFree: false,
    premium: false,
  });

  useEffect(() => {
    if (!apiKey || apiKey.length < 10) {
      setLiveModels([]);
      return;
    }
    const fetchModels = async () => {
      setLoading(true);
      try {
        const endpointMap: Record<Provider, string> = {
          openrouter: `/api/openrouter-models?apiKey=${encodeURIComponent(apiKey)}`,
          groq: `/api/groq-models?apiKey=${encodeURIComponent(apiKey)}`,
          gemini: `/api/gemini-models?apiKey=${encodeURIComponent(apiKey)}`,
          openai: `/api/openai-models?apiKey=${encodeURIComponent(apiKey)}`,
        };
        const res = await fetch(endpointMap[provider]);
        const data = await res.json();
        if (data.models) setLiveModels(data.models);
      } catch (err) {
        console.error(`Failed to load ${provider} models:`, err);
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, [apiKey, provider]);

  const staticModels = React.useMemo(() => {
    switch (provider) {
      case 'groq': return STATIC_GROQ_MODELS;
      case 'gemini': return STATIC_GEMINI_MODELS;
      case 'openai': return STATIC_OPENAI_MODELS;
      default: return STATIC_OPENROUTER_MODELS;
    }
  }, [provider]);

  const allModels = React.useMemo(() => {
    if (liveModels.length > 0) {
      return liveModels.map(m => {
        const id = m.id.toLowerCase();
        let cat = 'premium';
        const isFree = id.includes(':free') || id.includes('flash-lite') || id.includes('flash-8b') || id.includes('gpt-3.5') || id.includes('4o-mini') || m.pricing === 0 || m.pricing === null;
        const isReasoning = id.includes('r1') || id.includes('o1') || id.includes('o3') || id.includes('reasoning') || id.includes('thinking');
        if (isReasoning) {
          cat = 'reasoning';
        } else if (isFree || provider === 'groq') {
          cat = (id.includes('flash') || id.includes('mini') || id.includes('8b') || id.includes('7b') || id.includes('instant') || id.includes('versatile')) ? 'free' : 'otherFree';
        }
        if (provider === 'groq' && (id.includes('70b') || id.includes('versatile'))) cat = 'groq';
        return { id: m.id, name: m.name || m.id, category: cat, pricing: m.pricing };
      });
    }
    return staticModels;
  }, [liveModels, staticModels, provider]);

  const filteredModels = React.useMemo(() => {
    if (!search.trim()) return allModels;
    const lower = search.toLowerCase();
    return allModels.filter(m => m.name.toLowerCase().includes(lower) || m.id.toLowerCase().includes(lower));
  }, [allModels, search]);

  useEffect(() => {
    if (search.trim()) {
      const activeCats: Record<string, boolean> = {};
      filteredModels.forEach(m => { activeCats[m.category] = true; });
      setOpenCategories(prev => ({ ...prev, ...activeCats }));
    }
  }, [filteredModels, search]);

  const categories = [
    { id: 'groq', title: 'Groq Default', desc: 'Fastest — direct Groq', icon: Zap, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', badgeColor: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
    { id: 'free', title: 'Fast & Free', desc: 'Quick answers', icon: Rocket, color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20', badgeColor: 'bg-teal-500/20 text-teal-700 dark:text-teal-300' },
    { id: 'reasoning', title: 'Reasoning', desc: 'Shows thinking', icon: Zap, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', badgeColor: 'bg-amber-500/20 text-amber-700 dark:text-amber-300' },
    { id: 'otherFree', title: 'Other Free', desc: 'More free models', icon: Globe, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', badgeColor: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' },
    { id: 'premium', title: 'Premium', desc: 'Paid — most capable', icon: Gem, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', badgeColor: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  ];

  const defaultVal = PROVIDER_DEFAULTS[provider];

  return (
    <div className="w-full space-y-3.5 apple-card hover:transform-none !bg-white/80 dark:!bg-[#0c1220]/40 p-4 rounded-2xl">
      <div className="text-[9.5px] font-sans font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>{PROVIDER_LABELS[provider]}</span>
        </div>
        {loading && <span className="text-[9px] text-primary animate-pulse">Loading live models…</span>}
      </div>

      {/* Search box */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          placeholder="Search models..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-11 bg-white/40 dark:bg-black/30 border border-slate-200/50 dark:border-white/5 rounded-2xl pl-10 pr-4 text-xs focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-text-primary transition-all font-sans"
        />
      </div>

      {/* Accordion Categories */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">

        {/* Auto / Recommended */}
        <button
          type="button"
          onClick={() => onChange(defaultVal)}
          className={`w-full text-left p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
            value === defaultVal || value === 'auto'
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-slate-200/40 dark:border-white/5 bg-white/50 dark:bg-slate-900/20 text-text-secondary hover:bg-white/65 dark:hover:bg-slate-900/35'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            <span>Auto / Recommended (Best Speed & Accuracy)</span>
          </div>
          {(value === defaultVal || value === 'auto') && <Check className="w-4 h-4 text-primary" />}
        </button>

        {categories.map(cat => {
          // Only show groq category for groq provider
          if (cat.id === 'groq' && provider !== 'groq') return null;
          // Hide groq category for non-groq providers
          const catModels = filteredModels.filter(m => m.category === cat.id);
          if (catModels.length === 0 && search.trim()) return null;
          if (catModels.length === 0) return null;

          const isExpanded = !!openCategories[cat.id];
          const Icon = cat.icon;

          return (
            <div key={cat.id} className="border border-slate-200/40 dark:border-white/5 rounded-2xl overflow-hidden bg-white/60 dark:bg-slate-900/25">
              <button
                type="button"
                onClick={() => setOpenCategories(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/30 dark:hover:bg-white/5 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-1.5 rounded-xl border ${cat.color} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-800 dark:text-white block leading-tight">{cat.title}</span>
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 block truncate mt-0.5">{cat.desc}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.badgeColor}`}>
                    {catModels.length}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200/40 dark:border-white/5 bg-slate-50/50 dark:bg-black/10 divide-y divide-slate-200/30 dark:divide-white/5">
                  {catModels.map(model => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => onChange(model.id)}
                      className={`w-full text-left px-4 py-3 text-xs transition-all flex items-center justify-between hover:bg-primary/5 dark:hover:bg-primary/10 cursor-pointer ${
                        value === model.id ? 'text-primary font-bold bg-primary/5' : 'text-slate-650 dark:text-slate-355'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="block truncate">{model.name}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block truncate font-mono mt-0.5">{model.id}</span>
                      </div>
                      {value === model.id && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

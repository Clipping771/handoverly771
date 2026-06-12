'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Zap, Rocket, Globe, Gem, Check } from 'lucide-react';

const STATIC_MODELS = [
  // Groq Default
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq Default)', category: 'groq' },
  // Fast & Free
  { id: 'google/gemini-2.5-flash:free', name: 'Gemini 2.5 Flash (Free)', category: 'free' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', category: 'free' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', category: 'free' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B Instruct (Free)', category: 'free' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', category: 'free' },
  { id: 'openchat/openchat-7b:free', name: 'OpenChat 7B (Free)', category: 'free' },
  // Reasoning
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Reasoning)', category: 'reasoning' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free / Reasoning)', category: 'reasoning' },
  { id: 'openai/o1-mini', name: 'OpenAI o1 Mini', category: 'reasoning' },
  { id: 'openai/o3-mini', name: 'OpenAI o3 Mini', category: 'reasoning' },
  { id: 'openai/o1-preview', name: 'OpenAI o1 Preview', category: 'reasoning' },
  // Other Free
  { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3 (Free)', category: 'otherFree' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B Instruct (Free)', category: 'otherFree' },
  { id: 'microsoft/phi-3-medium-128k-instruct:free', name: 'Phi 3 Medium (Free)', category: 'otherFree' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Llama 3.1 Nemotron (Free)', category: 'otherFree' },
  // Premium
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', category: 'premium' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', category: 'premium' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', category: 'premium' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', category: 'premium' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', category: 'premium' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', category: 'premium' }
];

export default function CustomModelSelector({
  value,
  onChange,
  apiKey,
  provider
}: {
  value: string;
  onChange: (val: string) => void;
  apiKey: string;
  provider: 'openrouter' | 'groq';
}) {
  const [search, setSearch] = useState('');
  const [liveModels, setLiveModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    groq: provider === 'groq',
    free: provider === 'openrouter' || provider === 'groq',
    reasoning: provider === 'openrouter' || provider === 'groq',
    otherFree: false,
    premium: false
  });

  useEffect(() => {
    if (!apiKey || apiKey.length < 15) {
      setLiveModels([]);
      return;
    }
    const fetchModels = async () => {
      setLoading(true);
      try {
        const endpoint = provider === 'openrouter' ? `/api/openrouter-models?apiKey=${encodeURIComponent(apiKey)}` : `/api/groq-models?apiKey=${encodeURIComponent(apiKey)}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        if (data.models) {
          setLiveModels(data.models);
        }
      } catch (err) {
        console.error(`Failed to load ${provider} models:`, err);
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, [apiKey, provider]);

  const allModels = React.useMemo(() => {
    if (liveModels.length > 0) {
      return liveModels.map(m => {
        const id = m.id.toLowerCase();
        let cat = 'premium';
        const isFree = id.includes(':free') || m.pricing === 0 || m.pricing === '0' || m.pricing === null || m.pricing === undefined;
        const isReasoning = id.includes('r1') || id.includes('o1') || id.includes('o3') || id.includes('reasoning') || id.includes('thinking') || id.includes('deepseek-r1');
        
        if (id.includes('llama-3.3-70b')) {
          cat = 'groq';
        } else if (isReasoning) {
          cat = 'reasoning';
        } else if (isFree || provider === 'groq') {
          if (id.includes('flash') || id.includes('mini') || id.includes('8b') || id.includes('7b') || id.includes('instant') || id.includes('versatile')) {
            cat = 'free';
          } else {
            cat = 'otherFree';
          }
        }
        return {
          id: m.id,
          name: m.name || m.id,
          category: cat,
          pricing: m.pricing
        };
      });
    }
    
    // If no live models, fallback to static models
    if (provider === 'groq') {
      return [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', category: 'groq' },
        { id: 'llama-3.3-70b-specdec', name: 'Llama 3.3 70B Specdec', category: 'groq' },
        { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Llama 70B (Reasoning)', category: 'reasoning' },
        { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Qwen 32B (Reasoning)', category: 'reasoning' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', category: 'free' },
        { id: 'llama3-70b-8192', name: 'Llama 3 70B', category: 'otherFree' },
        { id: 'llama3-8b-8192', name: 'Llama 3 8B', category: 'free' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', category: 'otherFree' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', category: 'otherFree' }
      ];
    }
    return STATIC_MODELS;
  }, [liveModels, provider]);

  const filteredModels = React.useMemo(() => {
    if (!search.trim()) return allModels;
    const lower = search.toLowerCase();
    return allModels.filter(m => m.name.toLowerCase().includes(lower) || m.id.toLowerCase().includes(lower));
  }, [allModels, search]);

  useEffect(() => {
    if (search.trim()) {
      const activeCats: Record<string, boolean> = {};
      filteredModels.forEach(m => {
        activeCats[m.category] = true;
      });
      setOpenCategories(prev => ({ ...prev, ...activeCats }));
    }
  }, [filteredModels, search]);

  const categories = [
    {
      id: 'groq',
      title: 'Groq Default',
      desc: 'Fastest — direct Groq, no quota issues',
      icon: Zap,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badgeColor: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
    },
    {
      id: 'free',
      title: 'Fast & Free',
      desc: 'Quick answers',
      icon: Rocket,
      color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      badgeColor: 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
    },
    {
      id: 'reasoning',
      title: 'Reasoning',
      desc: 'Shows thinking — use with Brain Trust',
      icon: Zap,
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badgeColor: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
      footer: '⚡ Reasoning models best used with Brain Trust mode'
    },
    {
      id: 'otherFree',
      title: 'Other Free',
      desc: 'More free models',
      icon: Globe,
      color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      badgeColor: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
    },
    {
      id: 'premium',
      title: 'Premium',
      desc: 'Paid — fastest & most capable',
      icon: Gem,
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      badgeColor: 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
    }
  ];

  return (
    <div className="w-full border border-slate-200/50 dark:border-white/5 rounded-2xl overflow-hidden bg-slate-50/30 dark:bg-black/10 p-3.5 space-y-3">
      {/* Search box */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Search models..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-10 bg-white/50 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 rounded-xl pl-9 pr-4 text-xs focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-[#1f1f1f] dark:text-white transition-all"
        />
      </div>

      {/* Accordion Categories */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
        
        {/* Auto Option */}
        <button
          type="button"
          onClick={() => onChange(provider === 'groq' ? 'llama-3.3-70b-versatile' : 'google/gemini-2.5-flash')}
          className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
            value === 'google/gemini-2.5-flash' || value === 'llama-3.3-70b-versatile' || value === 'auto'
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-[#0d1425]/60 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            <span>Auto / Recommended (Best Speed & Accuracy)</span>
          </div>
          { (value === 'google/gemini-2.5-flash' || value === 'llama-3.3-70b-versatile' || value === 'auto') && <Check className="w-4 h-4 text-primary" /> }
        </button>

        {categories.map(cat => {
          // Filter out categories that are not supported by Groq
          if (provider === 'groq' && cat.id !== 'groq' && cat.id !== 'free' && cat.id !== 'otherFree' && cat.id !== 'reasoning') return null;

          const catModels = filteredModels.filter(m => m.category === cat.id);
          if (catModels.length === 0 && search.trim()) return null;

          const isExpanded = !!openCategories[cat.id];
          const Icon = cat.icon;

          return (
            <div key={cat.id} className="border border-slate-200/50 dark:border-white/5 rounded-xl overflow-hidden bg-white/70 dark:bg-[#0d1425]/60">
              {/* Category Header */}
              <button
                type="button"
                onClick={() => setOpenCategories(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-1.5 rounded-lg border ${cat.color} shrink-0`}>
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

              {/* Models List */}
              {isExpanded && (
                <div className="border-t border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-black/10 divide-y divide-slate-200/40 dark:divide-white/5">
                  {catModels.map(model => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => onChange(model.id)}
                      className={`w-full text-left px-4 py-2.5 text-xs transition-all flex items-center justify-between hover:bg-primary/5 dark:hover:bg-primary/10 cursor-pointer ${
                        value === model.id
                          ? 'text-primary font-bold bg-primary/5'
                          : 'text-slate-650 dark:text-slate-350'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="block truncate">{model.name}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block truncate font-mono mt-0.5">{model.id}</span>
                      </div>
                      {value === model.id && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
                    </button>
                  ))}
                  {cat.footer && (
                    <div className="p-2.5 text-[9px] text-amber-600 dark:text-amber-400 italic bg-amber-500/5 flex items-center gap-1">
                      <span>{cat.footer}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

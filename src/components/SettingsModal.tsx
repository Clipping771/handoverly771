'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Server, Cpu, Eye, EyeOff } from 'lucide-react';
import CustomModelSelector from './CustomModelSelector';
import { motion } from 'framer-motion';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showOpenrouter, setShowOpenrouter] = useState(false);
  const [showGroq, setShowGroq] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAnthropicKey(localStorage.getItem('user_anthropic_key') || '');
      setOpenrouterKey(localStorage.getItem('user_openrouter_key') || '');
      setOpenrouterModel(localStorage.getItem('user_openrouter_model') || 'anthropic/claude-3.5-sonnet');
      setGroqKey(localStorage.getItem('user_groq_key') || '');
      setGroqModel(localStorage.getItem('user_groq_model') || 'llama-3.3-70b-versatile');
      setOllamaUrl(localStorage.getItem('user_ollama_url') || 'http://127.0.0.1:11434');
      setOllamaModel(localStorage.getItem('user_ollama_model') || 'llama3');
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('user_anthropic_key', anthropicKey.trim());
    localStorage.setItem('user_openrouter_key', openrouterKey.trim());
    localStorage.setItem('user_openrouter_model', openrouterModel.trim() || 'anthropic/claude-3.5-sonnet');
    localStorage.setItem('user_groq_key', groqKey.trim());
    localStorage.setItem('user_groq_model', groqModel.trim() || 'llama-3.3-70b-versatile');
    localStorage.setItem('user_ollama_url', ollamaUrl.trim() || 'http://127.0.0.1:11434');
    localStorage.setItem('user_ollama_model', ollamaModel.trim() || 'llama3');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/30 dark:bg-[#020617]/65 backdrop-blur-md px-4 transition-all duration-300">
      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 15, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="w-full max-w-[840px] apple-card hover:transform-none !bg-white/92 dark:!bg-[#0c1220]/88 p-7 rounded-[32px] relative z-50 flex flex-col transition-all duration-300"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-white/5 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Cpu className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-text-primary">AI Engine Configuration</h3>
              <p className="text-[10px] text-text-secondary mt-0.5">Configure keys, engines, and routing side-by-side</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100/85 dark:hover:bg-slate-800/60 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors cursor-pointer outline-none focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Wide Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-[360px] max-h-[460px] overflow-y-auto pr-1.5 custom-scrollbar mb-4">
          
          {/* Left Column: API Keys & Ollama */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-2 mb-3">
              <Key className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <h4 className="text-[10.5px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Credentials & Servers
              </h4>
            </div>

            {/* Anthropic API Key */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Anthropic Claude Key
              </label>
              <div className="relative">
                <input
                  type={showAnthropic ? 'text' : 'password'}
                  placeholder="sk-ant-..."
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  className="w-full h-10 bg-white/45 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 rounded-xl px-4.5 pr-10 text-xs focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-text-primary font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropic(!showAnthropic)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer outline-none focus:outline-none"
                >
                  {showAnthropic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* OpenRouter API Key */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                OpenRouter Key
              </label>
              <div className="relative">
                <input
                  type={showOpenrouter ? 'text' : 'password'}
                  placeholder="sk-or-..."
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  className="w-full h-10 bg-white/45 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 rounded-xl px-4.5 pr-10 text-xs focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-text-primary font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenrouter(!showOpenrouter)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer outline-none focus:outline-none"
                >
                  {showOpenrouter ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Groq API Key */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Groq Key
              </label>
              <div className="relative">
                <input
                  type={showGroq ? 'text' : 'password'}
                  placeholder="gsk_..."
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  className="w-full h-10 bg-white/45 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 rounded-xl px-4.5 pr-10 text-xs focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-text-primary font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowGroq(!showGroq)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer outline-none focus:outline-none"
                >
                  {showGroq ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Ollama Local Integration */}
            <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/5 mt-3 space-y-3.5">
              <div className="flex items-center gap-1.5">
                <Server className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Ollama Local Config</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">API URL</label>
                  <input
                    type="text"
                    placeholder="http://127.0.0.1:11434"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    className="w-full h-10 bg-white/45 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 rounded-xl px-3.5 text-xs focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-text-primary font-mono transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Model Name</label>
                  <input
                    type="text"
                    placeholder="llama3"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="w-full h-10 bg-white/45 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 rounded-xl px-3.5 text-xs focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-text-primary font-mono transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: AI Engine Routing */}
          <div className="space-y-4 md:border-l md:border-slate-200/50 md:dark:border-white/5 md:pl-8">
            <div className="flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-2 mb-3">
              <Cpu className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <h4 className="text-[10.5px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Active Engine Routing
              </h4>
            </div>

            {/* OpenRouter Model Selector */}
            <div className="space-y-1.5">
              <CustomModelSelector
                value={openrouterModel}
                onChange={setOpenrouterModel}
                apiKey={openrouterKey}
                provider="openrouter"
              />
            </div>

            {/* Groq Model Selector */}
            <div className="space-y-1.5">
              <CustomModelSelector
                value={groqModel}
                onChange={setGroqModel}
                apiKey={groqKey}
                provider="groq"
              />
            </div>
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 pt-5 border-t border-slate-200/50 dark:border-white/5 mt-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="flex-1 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-250 text-xs font-semibold tracking-wider uppercase border border-slate-200/50 dark:border-white/5 transition-all outline-none focus:outline-none cursor-pointer"
          >
            Cancel
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            className="flex-1 h-11 rounded-full bg-primary hover:opacity-95 text-white text-xs font-semibold tracking-wider uppercase transition-all shadow-md shadow-primary/15 flex items-center justify-center outline-none focus:outline-none cursor-pointer"
          >
            Save Settings
          </motion.button>
        </div>

      </motion.div>
    </div>
  );
}

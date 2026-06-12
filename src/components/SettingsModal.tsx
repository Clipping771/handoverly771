'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff, Server, Cpu, Search, ChevronDown, ChevronUp, Zap, Rocket, Globe, Gem, Check } from 'lucide-react';
import CustomModelSelector from './CustomModelSelector';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 transition-all duration-300">
      <div className="w-full max-w-[420px] bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] p-7 rounded-[28px] shadow-2xl relative z-50 flex flex-col transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e3e3e3] dark:border-[#202024] mb-6">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-slate-800 dark:text-white" />
            <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">AI Engine Configuration</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#1c1c21] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-4.5 flex-1 max-h-[450px] overflow-y-auto pr-1">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
            Provide your custom keys and models below to execute LLM calls directly using your own accounts. Leaves these blank to fall back to facility-configured keys.
          </p>

          {/* Anthropic API Key */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> Anthropic Claude Key
            </label>
            <div className="relative">
              <input
                type={showAnthropic ? 'text' : 'password'}
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="w-full h-11 bg-slate-50 dark:bg-[#0b0b0d] border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-4 pr-10 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-100 text-[#1f1f1f] dark:text-white font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAnthropic(!showAnthropic)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer"
              >
                {showAnthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* OpenRouter API Key */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> OpenRouter Key
            </label>
            <div className="relative">
              <input
                type={showOpenrouter ? 'text' : 'password'}
                placeholder="sk-or-..."
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                className="w-full h-11 bg-slate-50 dark:bg-[#0b0b0d] border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-4 pr-10 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-100 text-[#1f1f1f] dark:text-white font-mono"
              />
              <button
                type="button"
                onClick={() => setShowOpenrouter(!showOpenrouter)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer"
              >
                {showOpenrouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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

          {/* Groq API Key */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> Groq Key
            </label>
            <div className="relative">
              <input
                type={showGroq ? 'text' : 'password'}
                placeholder="gsk_..."
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                className="w-full h-11 bg-slate-50 dark:bg-[#0b0b0d] border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-4 pr-10 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-100 text-[#1f1f1f] dark:text-white font-mono"
              />
              <button
                type="button"
                onClick={() => setShowGroq(!showGroq)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer"
              >
                {showGroq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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

          {/* Ollama API URL */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" /> Ollama Local API URL
            </label>
            <input
              type="text"
              placeholder="http://127.0.0.1:11434"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              className="w-full h-11 bg-slate-50 dark:bg-[#0b0b0d] border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-4 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-100 text-[#1f1f1f] dark:text-white font-mono"
            />
          </div>

          {/* Ollama Model Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ollama Model Name
            </label>
            <input
              type="text"
              placeholder="llama3"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="w-full h-11 bg-slate-50 dark:bg-[#0b0b0d] border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-4 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-100 text-[#1f1f1f] dark:text-white font-mono"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 pt-5 border-t border-[#e3e3e3] dark:border-[#202024] mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c21] dark:hover:bg-[#25252b] text-slate-700 dark:text-slate-250 text-xs font-semibold tracking-wider uppercase transition-all duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 h-11 rounded-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-[#ffffff] text-white dark:text-[#0b0b0d] text-xs font-semibold tracking-wider uppercase transition-all duration-300 shadow-md shadow-slate-200/50 dark:shadow-none flex items-center justify-center cursor-pointer"
          >
            Save Settings
          </button>
        </div>

      </div>
    </div>
  );
}

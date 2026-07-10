import React from 'react';
import { RefreshCw, Trash2, Settings, Brain, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

export const Header: React.FC = () => {
  const {
    loadingState,
    extractedData,
    isSettingsOpen,
    setSettingsOpen,
    extractCurrentPage,
    clearConversation,
    provider,
  } = useApp();

  const providerLabel: Record<string, string> = {
    openai: 'GPT-4o',
    gemini: 'Gemini',
    ollama: 'Ollama',
  };

  const isLoading = loadingState === 'Loading' || loadingState === 'Thinking';

  return (
    <header className="app-header glass shadow-sm sticky top-0 z-10">
      {/* Brand */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 flex-shrink-0">
          <Brain className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-black tracking-tight text-gradient leading-none">
            RUN TIME ERROR
          </span>
          {extractedData && (
            <span className="text-[9px] text-[var(--text-muted)] truncate max-w-[120px] leading-none mt-0.5">
              {extractedData.title}
            </span>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        {/* Provider pill */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-default)] transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          title="Change Provider"
        >
          <div className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow shadow-emerald-500/50"></span>
          </div>
          <span className="text-[10px] font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
            {providerLabel[provider] ?? provider}
          </span>
          <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />

        {extractedData && (
          <>
            <button
              onClick={extractCurrentPage}
              disabled={isLoading}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-white/5 disabled:opacity-40 transition-all"
              aria-label="Re-extract page"
              title="Re-extract page"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={clearConversation}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/8 transition-all"
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        <button
          onClick={() => setSettingsOpen(!isSettingsOpen)}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
            isSettingsOpen
              ? 'text-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-white/5'
          }`}
          aria-label="Settings"
          title="Settings"
        >
          <Settings
            className={`w-3.5 h-3.5 transition-transform duration-300 ${isSettingsOpen ? 'rotate-45' : ''}`}
          />
        </button>
      </div>
    </header>
  );
};

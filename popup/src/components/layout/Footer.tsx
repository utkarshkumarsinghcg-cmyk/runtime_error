import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Sparkles, Languages, Mic, Zap, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

const PROVIDERS = [{ value: 'ollama', label: 'Llama 3.2 (3B)' }] as const;

export const Footer: React.FC = () => {
  const { sendMessage, loadingState, extractedData, isSettingsOpen, provider, setProvider } =
    useApp();
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isThinking = loadingState === 'Thinking';
  const isDisabled = !extractedData || isSettingsOpen || loadingState === 'Loading';

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
  }, [inputText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking || isDisabled) return;
    sendMessage(inputText.trim());
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleShortcut = (query: string) => {
    if (isThinking || !extractedData) return;
    sendMessage(query);
  };

  const placeholder = !extractedData
    ? 'Extract a page first to start...'
    : isThinking
      ? 'Generating response...'
      : 'Ask anything about this page...';

  return (
    <footer className="app-footer pb-3">
      {/* Quick action chips */}
      {extractedData && !isSettingsOpen && (
        <div className="relative w-full">
          {/* Right fade mask */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-primary)] to-transparent pointer-events-none z-10" />
          
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pr-6">
            <button
              className="chip rounded-full px-3 py-1.5 shadow-sm active:scale-95"
              disabled={isThinking}
              onClick={() => handleShortcut('Give me a concise bullet-point summary of the key facts.')}
            >
              <Sparkles className="w-3 h-3 text-brand-500" />
              Summarize
            </button>
            <button
              className="chip rounded-full px-3 py-1.5 shadow-sm active:scale-95"
              disabled={isThinking}
              onClick={() => handleShortcut('Translate this page content to Spanish.')}
            >
              <Languages className="w-3 h-3 text-blue-500" />
              Spanish
            </button>
            <button
              className="chip rounded-full px-3 py-1.5 shadow-sm active:scale-95"
              disabled={isThinking}
              onClick={() => handleShortcut('What are the key takeaways from this page?')}
            >
              <Zap className="w-3 h-3 text-amber-500" />
              Takeaways
            </button>

          {/* Provider selector as a chip */}
          <div className="ml-auto flex-shrink-0">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'openai' | 'gemini' | 'ollama')}
              className="chip rounded-full pl-3 pr-2 py-1.5 shadow-sm border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500 transition-all appearance-none"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      )}

      {/* Input box */}
      <form onSubmit={handleSubmit} className="input-container shadow-md bg-[var(--bg-primary)] dark:bg-[var(--bg-secondary)] mt-1">
        <textarea
          ref={textareaRef}
          id="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isDisabled}
          rows={1}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          className="input-field custom-scrollbar"
          style={{ minHeight: '22px', maxHeight: '80px' }}
        />

        <div className="flex items-center justify-between">
          {/* Left actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isDisabled}
              title="Voice input (STT)"
              className="group relative w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-brand-500 hover:bg-brand-500/10 transition-all disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Mic className="w-4 h-4 transition-transform group-active:scale-90" />
            </button>
            <button
              type="button"
              disabled={isDisabled}
              title="Web access toggle"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-brand-500 hover:bg-brand-500/10 transition-all disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Globe className="w-4 h-4" />
            </button>
            {isThinking && (
              <span className="text-[9px] text-indigo-500 font-medium animate-pulse">
                Generating...
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            id="submit-message"
            type="submit"
            disabled={isDisabled || !inputText.trim() || isThinking}
            className="submit-btn"
            aria-label="Send message"
          >
            <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </form>

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 mt-2 select-none">
        <div className="flex items-center gap-1.5">
          {extractedData ? (
            <div className={`w-1.5 h-1.5 rounded-full shadow ${extractedData.truncated ? 'bg-amber-500 shadow-amber-500/50' : 'bg-emerald-500 shadow-emerald-500/50'}`} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 shadow shadow-slate-400/50" />
          )}
          <span className="text-[10px] text-[var(--text-secondary)] font-semibold tracking-tight">
            {extractedData ? `${extractedData.wordCount ?? 0} words extracted` : 'No page loaded'}
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-secondary)] font-medium">↵ to send · ⇧↵ newline</span>
      </div>
    </footer>
  );
};

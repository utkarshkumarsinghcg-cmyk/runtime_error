import React, { createContext, useContext, useState } from 'react';
import { popupMessaging } from '../services/popupMessaging.js';

export type LoadingState =
  'Idle' | 'Listening' | 'Thinking' | 'Speaking' | 'Error' | 'Offline' | 'Loading' | 'Empty';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface LogEntry {
  time: string;
  direction: 'OUT' | 'IN' | 'ERR' | 'SYS';
  action: string;
  detail: string;
}

interface AppContextType {
  logs: LogEntry[];
  extractedData: any | null;
  loadingState: LoadingState;
  messages: ChatMessage[];
  provider: 'ollama';
  language: string;
  voiceEnabled: boolean;
  autoSummarize: boolean;
  isSettingsOpen: boolean;
  setProvider: (provider: 'ollama') => void;
  setLanguage: (lang: string) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setAutoSummarize: (enabled: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  addLog: (direction: LogEntry['direction'], action: string, detail: string) => void;
  extractCurrentPage: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clearConversation: () => void;
  resetAllSettings: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('Empty');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  // Load preferences from local storage with safe fallbacks
  const [provider, setProviderState] = useState<'ollama'>(() => {
    return 'ollama';
  });
  const [language, setLanguageState] = useState<string>(() => {
    return localStorage.getItem('ai_companion_language') || 'English';
  });
  const [voiceEnabled, setVoiceState] = useState<boolean>(() => {
    return localStorage.getItem('ai_companion_voice') !== 'false';
  });
  const [autoSummarize, setAutoSummarizeState] = useState<boolean>(() => {
    return localStorage.getItem('ai_companion_auto_summarize') === 'true';
  });

  const setProvider = (val: 'ollama') => {
    setProviderState(val);
    localStorage.setItem('ai_companion_provider', val);
    addLog('SYS', 'SETTINGS_UPDATE', `LLM Provider changed to: ${val}`);
  };

  const setLanguage = (val: string) => {
    setLanguageState(val);
    localStorage.setItem('ai_companion_language', val);
    addLog('SYS', 'SETTINGS_UPDATE', `Target language changed to: ${val}`);
  };

  const setVoiceEnabled = (val: boolean) => {
    setVoiceState(val);
    localStorage.setItem('ai_companion_voice', String(val));
    addLog('SYS', 'SETTINGS_UPDATE', `TTS feedback ${val ? 'enabled' : 'disabled'}`);
  };

  const setAutoSummarize = (val: boolean) => {
    setAutoSummarizeState(val);
    localStorage.setItem('ai_companion_auto_summarize', String(val));
    addLog('SYS', 'SETTINGS_UPDATE', `Auto-summarize on load ${val ? 'enabled' : 'disabled'}`);
  };

  const addLog = (direction: LogEntry['direction'], action: string, detail: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, direction, action, detail }, ...prev]);
  };

  const extractCurrentPage = async () => {
    setLoadingState('Loading');
    addLog('OUT', 'TRIGGER_EXTRACTION', 'Requesting content page extraction');

    try {
      const data = await popupMessaging.triggerExtraction();
      setExtractedData(data);
      addLog('IN', 'TRIGGER_EXTRACTION', `Success. Extracted title: "${data.title}"`);

      const welcome: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        text: `Successfully parsed webpage content for: **${data.title}** (${data.wordCount} words).\n\nAsk me any grounded question about the page content, or run translations/summarizations.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages([welcome]);
      setLoadingState('Idle');

      if (autoSummarize) {
        await summarizePage(data);
      }
    } catch (err: any) {
      setLoadingState('Error');
      addLog('ERR', 'TRIGGER_EXTRACTION', err.message || 'Page extraction failed');
      setMessages([
        {
          id: 'error_extract',
          role: 'assistant',
          text: `❌ **Failed to extract webpage content.**\n\nError: *${err.message || 'Page context lost'}*. Please ensure you are on a valid webpage and refresh the page.`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  const summarizePage = async (pageData: any) => {
    setLoadingState('Thinking');
    addLog('OUT', 'SUMMARIZE_REQUEST', `Requesting article summary via provider: ${provider}`);

    try {
      addLog('SYS', 'SUMMARIZE', 'Running summarization pipeline...');
      const summaryText = await popupMessaging.submitQuery(
        pageData,
        [],
        'Provide a concise, comprehensive summary detailing key facts and highlights of this document.',
        provider
      );

      const responseMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `### Article Summary\n\n${summaryText.text}`,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, responseMsg]);
      setLoadingState('Idle');
      addLog('IN', 'SUMMARIZE_RESPONSE', 'Summary digest generated successfully');
    } catch (err: any) {
      setLoadingState('Error');
      addLog('ERR', 'SUMMARIZE_REQUEST', err.message || 'Summarization failed');
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !extractedData) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoadingState('Thinking');
    addLog('OUT', 'USER_QUERY', `Sent: "${text}"`);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));

      const result = await popupMessaging.submitQuery(extractedData, history, text, provider);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: result.text,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setLoadingState('Idle');
      addLog('IN', 'USER_QUERY', `Received answer (${result.provider || 'unknown'})`);
    } catch (err: any) {
      setLoadingState('Error');
      addLog('ERR', 'USER_QUERY', err.message || 'Query call failed');

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `❌ **Failed to retrieve answer from LLM.**\n\nError: *${err.message || 'Unknown network anomaly'}*.`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setLoadingState(extractedData ? 'Idle' : 'Empty');
    addLog('SYS', 'CLEAR_HISTORY', 'Conversation history logs cleared');
  };

  const resetAllSettings = () => {
    setProvider('ollama');
    setLanguage('English');
    setVoiceEnabled(true);
    setAutoSummarize(false);
    addLog('SYS', 'RESET_SETTINGS', 'Settings values reset to factory defaults');
  };

  return (
    <AppContext.Provider
      value={{
        logs,
        extractedData,
        loadingState,
        messages,
        provider,
        language,
        voiceEnabled,
        autoSummarize,
        isSettingsOpen,
        setProvider,
        setLanguage,
        setVoiceEnabled,
        setAutoSummarize,
        setSettingsOpen,
        addLog,
        extractCurrentPage,
        sendMessage,
        clearConversation,
        resetAllSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

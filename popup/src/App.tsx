import React, { useEffect, useState } from 'react';
import { Header } from './components/layout/Header.js';
import { Footer } from './components/layout/Footer.js';
import { Sidebar, TabType } from './components/layout/Sidebar.js';
import { ChatWindow } from './components/conversation/ChatWindow.js';
import { Dashboard } from './components/conversation/Dashboard.js';
import { SettingsPanel } from './components/settings/SettingsPanel.js';
import { StateIndicator } from './components/states/StateIndicators.js';
import { TypingIndicator } from './components/loader/TypingIndicator.js';
import { ChatSkeleton } from './components/loader/Skeleton.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { AppProvider, useApp } from './context/AppContext.js';
import { AnimatePresence } from 'framer-motion';

const AppContent: React.FC = () => {
  const { loadingState, messages, extractCurrentPage, isSettingsOpen, setSettingsOpen } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  // Trigger extraction on startup
  useEffect(() => {
    extractCurrentPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync settings panel ↔ tab state
  useEffect(() => {
    if (isSettingsOpen) setActiveTab('settings');
    else if (activeTab === 'settings') setActiveTab('chat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsOpen]);

  useEffect(() => {
    setSettingsOpen(activeTab === 'settings');
  }, [activeTab, setSettingsOpen]);

  const showSkeleton = loadingState === 'Loading' && messages.length === 0;
  const showChat = messages.length > 0;

  return (
    <div
      id="app-root"
      className="flex flex-row bg-[var(--bg-primary)] relative overflow-hidden select-none noise transition-colors duration-300"
      style={{ width: 400, height: 580 }}
    >
      {/* Main column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <Header />

        <main className="flex-1 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
            {activeTab === 'settings' && <SettingsPanel key="settings" />}
          </AnimatePresence>

          {activeTab !== 'settings' && (
            <>
              {showSkeleton ? (
                <ChatSkeleton />
              ) : activeTab === 'chat' && !showChat ? (
                <Dashboard />
              ) : activeTab === 'chat' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <ChatWindow messages={messages} loadingState={loadingState} />
                  <AnimatePresence>
                    {loadingState === 'Thinking' && (
                      <div className="px-4 pb-3">
                        <TypingIndicator />
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              ) : activeTab === 'read' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
                  <StateIndicator state={loadingState} onClickAction={extractCurrentPage} />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      Audiobook Mode
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] max-w-[180px] leading-relaxed">
                      Use the chat to trigger read-aloud and TTS controls.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                    <span className="text-xl">🌐</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      Translation
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] max-w-[180px] leading-relaxed">
                      Use the chat shortcuts to translate this page to any language.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        <Footer />
      </div>

      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeProvider>
  );
}

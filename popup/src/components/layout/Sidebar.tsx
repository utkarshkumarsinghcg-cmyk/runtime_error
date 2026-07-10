import React from 'react';
import { MessageSquare, BookOpen, Languages, Settings } from 'lucide-react';

export type TabType = 'chat' | 'read' | 'translate' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const tabs = [
  { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare },
  { id: 'read' as TabType, label: 'Read', icon: BookOpen },
  { id: 'translate' as TabType, label: 'Tr.', icon: Languages },
  { id: 'settings' as TabType, label: 'Config', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="w-14 h-full flex flex-col items-center py-3 gap-1 border-l border-[var(--border-subtle)] bg-[var(--bg-primary)] dark:bg-[var(--bg-secondary)] flex-shrink-0">
      {/* Logo dot — decorative */}
      <div className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 mb-3 flex-shrink-0 shadow shadow-indigo-500/40" />

      {/* Nav tabs */}
      <nav className="flex flex-col items-center gap-1 flex-1 w-full px-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              id={`nav-tab-${id}`}
              onClick={() => setActiveTab(id)}
              title={label}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`nav-btn ${isActive ? 'active' : ''} w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.8} />
              <span
                className="text-[8px] mt-0.5 font-semibold tracking-tight leading-none"
                style={{ letterSpacing: '-0.01em' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* User avatar */}
      <div className="flex-shrink-0 mt-1 relative">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-violet-700 flex items-center justify-center text-[10px] font-black text-white shadow-md shadow-[var(--accent-glow)] ring-2 ring-[var(--bg-primary)] dark:ring-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          U
        </div>
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--bg-primary)] dark:border-[var(--bg-secondary)] rounded-full"></div>
      </div>
    </aside>
  );
};

import React from 'react';
import { Mic, MessageSquare } from 'lucide-react';
import { useCompanionState } from '../context/CompanionContext';

export default function FloatingActionButton() {
  const { isSidebarOpen, setSidebarOpen, isListening } = useCompanionState();

  const handleClick = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  return (
    <div 
      className={`fixed bottom-6 right-6 z-[999999] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] ${
        isSidebarOpen ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 pointer-events-auto'
      }`}
    >
      <button
        onClick={handleClick}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/30 border border-white/10 hover:scale-110 hover:-translate-y-1 hover:shadow-indigo-500/50 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] animate-anti-gravity"
        title="Open AI Companion"
      >
        {isListening ? (
          <Mic className="h-6 w-6 animate-pulse" />
        ) : (
          <MessageSquare className="h-6 w-6 transition-transform group-hover:rotate-12" />
        )}
        
        {/* Pulsing Listening Indicator */}
        <span className={`absolute top-0 right-0 flex h-3.5 w-3.5 ${isListening ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border border-slate-900"></span>
        </span>
      </button>
    </div>
  );
}

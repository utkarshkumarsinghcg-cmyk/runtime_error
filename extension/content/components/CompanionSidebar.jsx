import React, { useState } from 'react';
import { 
  X, ExternalLink, Sparkles, Send, Play, Pause, 
  Square, FileText, Languages, Mic, MicOff, RefreshCw
} from 'lucide-react';
import { useCompanionState } from '../context/CompanionContext';

export default function CompanionSidebar() {
  const { 
    isSidebarOpen, setSidebarOpen, 
    isListening, setListening, 
    isSpeaking, setSpeaking,
    chatHistory, addChatMessage, 
    syncStatus, activeTab, setActiveTab 
  } = useCompanionState();

  const [inputVal, setInputVal] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = () => {
    if (!inputVal.trim()) return;
    addChatMessage('user', inputVal);
    setInputVal('');
    setIsThinking(true);

    // Simulate AI response after 1.5 seconds
    setTimeout(() => {
      setIsThinking(false);
      addChatMessage('assistant', "I've analyzed the page content. Let me know if you want me to expand on any technical details or summarize sections.");
    }, 1500);
  };

  const toggleListening = () => {
    setListening(!isListening);
  };

  const toggleSpeaking = () => {
    setSpeaking(!isSpeaking);
  };

  if (!isSidebarOpen) return null;

  return (
    <div 
      className="fixed inset-y-0 right-0 z-[999998] w-[400px] bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col font-sans animate-slide-in text-slate-200"
    >
      {/* Header Area */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          <h1 className="text-lg font-bold tracking-tight text-white">Aether AI</h1>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {syncStatus}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setActiveTab(activeTab === 'dashboard' ? 'sidebar' : 'dashboard')}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            title="Open Dashboard"
          >
            <ExternalLink className="h-4.5 w-4.5" />
          </button>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            title="Minimize"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Quick Actions Segment */}
      <div className="p-3 border-b border-white/10 flex gap-2 overflow-x-auto bg-slate-950/40 custom-scrollbar">
        <button 
          onClick={() => {
            setInputVal("Can you summarize the page content?");
            handleSend();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-950/20 text-xs font-semibold rounded-lg text-slate-300 transition-all shrink-0"
        >
          <FileText className="h-3.5 w-3.5 text-indigo-400" />
          Summarize Page
        </button>
        <button 
          onClick={() => {
            setInputVal("Explain this paragraph.");
            handleSend();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-950/20 text-xs font-semibold rounded-lg text-slate-300 transition-all shrink-0"
        >
          <Languages className="h-3.5 w-3.5 text-indigo-400" />
          Explain Paragraph
        </button>
      </div>

      {/* Chat Thread */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-slate-950/10">
        {chatHistory.map((msg) => (
          <div 
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-1`}
          >
            <div className={`flex items-start gap-2 max-w-[85%]`}>
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center border border-indigo-400/20 text-white font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                  A
                </div>
              )}
              <div 
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-sm border ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none' 
                    : 'bg-slate-900 border-white/10 text-slate-200 rounded-tl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
            <span className="text-[10px] text-slate-500 px-9">{msg.timestamp}</span>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-500" />
            <span>Aether is thinking...</span>
          </div>
        )}
      </div>

      {/* Media / TTS Controller & Waveform */}
      <div className="p-4 bg-slate-900/40 border-t border-white/10 space-y-4">
        <div className="flex items-center justify-between bg-slate-950/50 border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleSpeaking}
              className={`p-2 rounded-lg transition-all ${
                isSpeaking ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              {isSpeaking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button 
              onClick={() => setSpeaking(false)}
              className="p-2 bg-slate-900 text-slate-400 hover:text-white border border-white/10 rounded-lg transition-all"
            >
              <Square className="h-4 w-4" />
            </button>
          </div>

          {/* Looping Audio Waveform */}
          <div className="flex items-center gap-1 px-4 h-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
              const animDelay = `${bar * 0.15}s`;
              return (
                <span 
                  key={bar}
                  className={`w-1 bg-indigo-500 rounded-full transition-all duration-300 ${
                    isSpeaking ? 'animate-pulse-subtle h-4' : 'h-1'
                  }`}
                  style={{ 
                    animationDelay: animDelay,
                    height: isSpeaking ? undefined : '4px' 
                  }}
                ></span>
              );
            })}
          </div>

          <span className="text-[11px] font-mono text-slate-400">0:14</span>
        </div>

        {/* Input Bar */}
        <div className="space-y-2">
          <div className="relative flex items-center bg-slate-950 border border-white/10 rounded-xl focus-within:border-indigo-500/50 transition-all p-1">
            <input 
              type="text" 
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask Aether about this page..." 
              className="flex-1 bg-transparent border-none text-sm text-slate-100 placeholder-slate-500 py-2.5 px-3 focus:outline-none focus:ring-0"
            />
            <button 
              onClick={handleSend}
              className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between px-1 text-[10px] text-slate-500">
            <span>Press Enter to send</span>
            <button 
              onClick={toggleListening}
              className="flex items-center gap-1 hover:text-indigo-400 transition-colors"
            >
              {isListening ? (
                <>
                  <MicOff className="h-3 w-3 text-amber-500" />
                  <span className="text-amber-500">Stop Voice Input</span>
                </>
              ) : (
                <>
                  <Mic className="h-3 w-3" />
                  <span>Voice input</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

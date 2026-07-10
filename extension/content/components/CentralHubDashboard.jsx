import React, { useState } from 'react';
import { 
  Search, Clock, Settings, Plus, Code, FileText, Bug, 
  ArrowUp, Sparkles, X, Copy, Check 
} from 'lucide-react';
import { useCompanionState } from '../context/CompanionContext';

export default function CentralHubDashboard() {
  const { setActiveTab } = useCompanionState();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [dashboardQuery, setDashboardQuery] = useState('');

  const historyItems = [
    {
      id: 'neural',
      title: 'Neural Architecture Optimization',
      time: '10m ago',
      preview: 'Analyzing the trade-offs in sparse attention matrices and transformer blocks...',
      category: 'TODAY',
      icon: Code,
      iconColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
    },
    {
      id: 'q4',
      title: 'Q4 Dataset Ingestion Pipeline',
      time: '2h ago',
      preview: 'Reviewing the ETL logs for potential schema misalignments and processing bottlenecks...',
      category: 'TODAY',
      icon: FileText,
      iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    },
    {
      id: 'leak',
      title: 'Resolve Memory Leak in Auth Service',
      time: '5h ago',
      preview: 'Tracing heap allocations during concurrent token validation calls to find reference loops...',
      category: 'TODAY',
      icon: Bug,
      iconColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    },
    {
      id: 'roadmap',
      title: 'Draft: Q1 Technical Roadmap',
      time: 'Yesterday',
      preview: 'Outlining priorities for infrastructure scaling, multi-region database migration...',
      category: 'YESTERDAY',
      icon: FileText,
      iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
    }
  ];

  const filteredHistory = historyItems.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pythonCode = `def apply_sparse_mask(attention_scores, sparsity_ratio=0.75):
    # Calculate threshold for dropping connections
    threshold_idx = int(attention_scores.shape[-1] * (1 - sparsity_ratio))

    # Sort and identify top-k elements
    sorted_scores, indices = torch.sort(attention_scores, dim=-1, descending=True)
    threshold_value = sorted_scores[..., threshold_idx][..., None]

    # Apply mask: keep scores >= threshold, set others to -inf
    mask = attention_scores < threshold_value
    attention_scores.masked_fill_(mask, float('-inf'))

    return attention_scores`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[999990] bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">Aether AI</span>
          </div>
          <nav className="flex items-center gap-6">
            <button className="text-sm font-semibold text-white border-b-2 border-indigo-500 py-5">Dashboard</button>
            <button className="text-sm font-semibold text-slate-400 hover:text-white py-5 transition-colors">Context</button>
            <button className="text-sm font-semibold text-slate-400 hover:text-white py-5 transition-colors">Sync</button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all">
            <Clock className="h-5 w-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all">
            <Settings className="h-5 w-5" />
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg transition-all shadow-md shadow-indigo-600/10">
            <Plus className="h-4 w-4" />
            New Chat
          </button>
          <button 
            onClick={() => setActiveTab('sidebar')}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all border border-slate-800"
            title="Back to Page Companion"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Viewport Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side Navigation Strip (History) */}
        <aside className="w-80 border-r border-slate-800 bg-slate-950/40 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 border-b border-slate-800">
            <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-lg px-3 focus-within:border-slate-700">
              <Search className="h-4 w-4 text-slate-500 mr-2 shrink-0" />
              <input 
                type="text" 
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none text-xs text-slate-200 placeholder-slate-500 py-2.5 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
          
          <div className="flex-1 py-4 space-y-6">
            {['TODAY', 'YESTERDAY'].map((category) => {
              const items = filteredHistory.filter(item => item.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category} className="space-y-2 px-4">
                  <h3 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-2">{category}</h3>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.id === 'neural';
                      return (
                        <div 
                          key={item.id}
                          className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            isActive 
                              ? 'bg-slate-800/80 border-indigo-500/25 shadow-lg shadow-indigo-950/20' 
                              : 'bg-transparent border-transparent hover:bg-slate-900/50 hover:border-slate-800'
                          }`}
                        >
                          <span className={`h-8 w-8 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 ${item.iconColor}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-indigo-300' : 'text-slate-300 group-hover:text-slate-200'}`}>
                                {item.title}
                              </h4>
                              <span className="text-[9px] text-slate-500 shrink-0 font-medium">{item.time}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate leading-relaxed">
                              {item.preview}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Side Main Document Panel */}
        <main className="flex-1 bg-slate-900 flex flex-col overflow-y-auto custom-scrollbar relative p-8">
          <div className="max-w-4xl mx-auto w-full space-y-6 pb-24">
            
            {/* Header badges */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-[10px] font-semibold tracking-wider text-slate-400 rounded-md">ARCHITECTURE</span>
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-[10px] font-semibold tracking-wider text-slate-400 rounded-md">RESEARCH</span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold tracking-wider text-amber-500 rounded-md">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Active Session
              </span>
            </div>

            {/* Document Title */}
            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Neural Architecture Optimization in Sparse Networks
            </h1>

            {/* Editorial Content */}
            <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
              <p>
                Recent advancements in sparse attention mechanisms suggest a significant reduction in computational overhead for large language models, provided the network architecture is properly tuned. This session explores the trade-offs between dense scaling limits and optimized routing paths.
              </p>
              
              <h2 className="text-lg font-bold text-white tracking-tight pt-4">The Challenge of Sparsity</h2>
              <p>
                Implementing sparsity isn't merely about dropping connections; it requires a systematic approach to identifying which patterns hold semantic weight. Our initial findings indicate that naive pruning degrades performance on reasoning tasks significantly. Rather than static weight reduction, dynamic attention masking presents a viable alternative.
              </p>
            </div>

            {/* Fenced Python Code Block Container */}
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-2xl bg-slate-950 mt-6">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <Code className="h-3.5 w-3.5 text-indigo-400" />
                  <span>attention_masking.py</span>
                </div>
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-750 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-slate-300 custom-scrollbar">
                <code>{pythonCode}</code>
              </pre>
            </div>
          </div>

          {/* Hovering Context Input Bar (Bottom Right aligned inside page view) */}
          <div className="absolute bottom-6 right-8 left-8 max-w-4xl mx-auto w-full">
            <div className="relative flex items-center bg-slate-950 border border-indigo-500/20 focus-within:border-indigo-500/50 shadow-xl shadow-slate-950/50 rounded-2xl p-1.5 max-w-2xl ml-auto">
              <input 
                type="text" 
                value={dashboardQuery}
                onChange={(e) => setDashboardQuery(e.target.value)}
                placeholder="Ask Aether about this context..." 
                className="flex-1 bg-transparent border-none text-xs text-slate-100 placeholder-slate-500 py-2.5 px-3.5 focus:outline-none focus:ring-0"
              />
              <button className="h-9 w-9 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center">
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

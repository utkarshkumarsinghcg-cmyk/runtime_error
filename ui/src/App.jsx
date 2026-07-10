import React, { useState, useEffect, useRef } from 'react';
import { useSpeechSynthesis, useSpeechRecognition } from './hooks/useSpeech';
import { classifyIntent, Intents } from './utils/intentClassifier';

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const [uiState, setUiState] = useState('Idle'); // Idle | Thinking | Listening | Speaking | Error
  const [statusLabel, setStatusLabel] = useState('Ready');
  
  // Custom states for dropdown menus
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isIntentOpen, setIsIntentOpen] = useState(false);
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // chat | archive | models
  const [archiveSearch, setArchiveSearch] = useState('');
  const [selectedArchiveId, setSelectedArchiveId] = useState(null);
  const [backendStatus, setBackendStatus] = useState('offline'); // online | offline
  const [downloadedModels, setDownloadedModels] = useState([]);
  const [showModelHub, setShowModelHub] = useState(false); // for extension popup overlay

  // Model & Timer State
  const [activeModel, setActiveModel] = useState('llama3.1:8b'); // Loaded dynamically
  const [timerVal, setTimerVal] = useState('0.0');
  const [generationTime, setGenerationTime] = useState(null);

  const [inputText, setInputText] = useState('');
  const [hasConsent, setHasConsent] = useState(null); // null checking

  const chatHistoryRef = useRef(null);
  const langRef = useRef(null);
  const intentRef = useRef(null);
  const fileInputRef = useRef(null);
  const timerIntervalRef = useRef(null);
  // Refs to avoid stale closures in async callbacks
  const sessionsRef = useRef([]);
  const currentSessionIdRef = useRef(null);

  // Speech Controllers
  const tts = useSpeechSynthesis();
  const stt = useSpeechRecognition();

  // Responsive state - Sidebar is active only in full webpage dashboard views (width > 900px)
  const [isWebMode, setIsWebMode] = useState(window.innerWidth > 900);

  useEffect(() => {
    const handleResize = () => {
      setIsWebMode(window.innerWidth > 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper to map language names to language codes
  const getLangCode = (langName) => {
    switch (langName) {
      case 'Hindi': return 'hi-IN';
      case 'Bengali': return 'bn-IN';
      case 'Tamil': return 'ta-IN';
      case 'Telugu': return 'te-IN';
      case 'Marathi': return 'mr-IN';
      case 'Gujarati': return 'gu-IN';
      case 'Kannada': return 'kn-IN';
      case 'Malayalam': return 'ml-IN';
      case 'Punjabi': return 'pa-IN';
      case 'Odia': return 'or-IN';
      case 'Urdu': return 'ur-IN';
      case 'Sanskrit': return 'sa-IN';
      case 'English (UK)': return 'en-GB';
      case 'English (US)':
      default: return 'en-US';
    }
  };

  // Get active session — always read from ref to avoid stale closures in async callbacks
  const getActiveSession = () => {
    return sessionsRef.current.find(s => s.id === currentSessionIdRef.current) || null;
  };

  // Load saved sessions on startup
  useEffect(() => {
    const loadSessions = () => {
      const defaultSession = {
        id: Date.now(),
        title: 'Central Command',
        messages: [{ role: 'assistant', content: 'MOMENTUM OS v4.0.12 INITIALIZED. SECURE CHANNEL ACCESSED VIA LOCALHOST. READY TO PROCESS INSTRUCTIONS.' }],
        pageContent: null,
        targetLanguage: 'English (US)',
        activeIntent: 'SUMMARIZE',
        intentResponses: {
          SUMMARIZE: 'SYSTEM LOG: Awaiting page extraction. Click "Extract Page" below to compile context.',
          EXPLAIN_SIMPLE: 'SYSTEM LOG: ELI5 explanation cache is empty. Extract context first.',
          EXAMPLE: 'SYSTEM LOG: Topic illustration compiler is offline. Extract context first.',
        }
      };

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['savedSessions', 'lastSessionId'], (result) => {
          let loaded = result.savedSessions || [];
          let lastId = result.lastSessionId;
          if (loaded.length === 0) {
            loaded = [defaultSession];
            lastId = defaultSession.id;
            chrome.storage.local.set({ savedSessions: loaded, lastSessionId: lastId });
          }
          const resolvedId = lastId || loaded[0].id;
          // Sync refs immediately so async callbacks have fresh data from startup
          sessionsRef.current = loaded;
          currentSessionIdRef.current = resolvedId;
          setSessions(loaded);
          setCurrentSessionId(resolvedId);
        });
      } else {
        // Local Storage fallback
        let loaded = [];
        try {
          loaded = JSON.parse(localStorage.getItem('savedSessions')) || [];
        } catch(e) {}
        let lastId = localStorage.getItem('lastSessionId');
        if (loaded.length === 0) {
          loaded = [defaultSession];
          lastId = defaultSession.id.toString();
          localStorage.setItem('savedSessions', JSON.stringify(loaded));
          localStorage.setItem('lastSessionId', lastId);
        }
        const resolvedId = Number(lastId) || loaded[0].id;
        // Sync refs immediately so async callbacks have fresh data from startup
        sessionsRef.current = loaded;
        currentSessionIdRef.current = resolvedId;
        setSessions(loaded);
        setCurrentSessionId(resolvedId);
      }
    };

    loadSessions();
  }, []);

  // Save sessions to storage
  const saveSessionsToStorage = (updatedList, activeId) => {
    // Keep refs fresh so async callbacks always see current data
    sessionsRef.current = updatedList;
    currentSessionIdRef.current = activeId;
    setSessions(updatedList);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ savedSessions: updatedList, lastSessionId: activeId });
    } else {
      localStorage.setItem('savedSessions', JSON.stringify(updatedList));
      localStorage.setItem('lastSessionId', activeId.toString());
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load consent state on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['privacyConsent'], (result) => {
        setHasConsent(!!result.privacyConsent);
      });
    } else {
      const localConsent = localStorage.getItem('privacyConsent');
      setHasConsent(!!localConsent);
    }
  }, []);

  // Auto-detect local running backend/model status on mount and every 5 seconds
  useEffect(() => {
    const checkBackendStatus = () => {
      fetch('http://localhost:4000/api/status')
        .then(res => {
          if (!res.ok) throw new Error('Network response not ok');
          return res.json();
        })
        .then(data => {
          setBackendStatus(data.status);
          if (data.status === 'online') {
            setDownloadedModels(data.models || []);
            if (data.activeModel) {
              setActiveModel(data.activeModel);
            }
          } else {
            setDownloadedModels([]);
          }
        })
        .catch(err => {
          console.warn('[Backend Status Poll failed]', err);
          setBackendStatus('offline');
          setDownloadedModels([]);
        });
    };

    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-request microphone permission if opened in a tab with ?request_mic=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('request_mic') === 'true') {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          console.log('[Permission Tab] Microphone permission successfully granted.');
          // Stop the stream tracks immediately to release the microphone
          stream.getTracks().forEach(track => track.stop());
          alert('🎙️ Microphone access granted! You can now close this tab and use voice commands in the extension.');
        })
        .catch((err) => {
          console.error('[Permission Tab] Microphone permission denied:', err);
        });
    }
  }, []);

  // Auto-extract page content on mount if in extension mode and session has no content yet
  useEffect(() => {
    if (!isWebMode) {
      const timer = setTimeout(() => {
        const active = getActiveSession();
        if (active && !active.pageContent) {
          console.log('[Auto-Extract] Triggering automatic page extraction on mount...');
          handleExtract();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isWebMode, currentSessionId]);

  // Save consent
  const handleAcceptConsent = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ privacyConsent: true }, () => {
        setHasConsent(true);
      });
    } else {
      localStorage.setItem('privacyConsent', 'true');
      setHasConsent(true);
    }
  };

  // Stopwatch controls
  const startTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setGenerationTime(null);
    setTimerVal('0.0');
    const startTime = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setTimerVal(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Fetch active LLM model on startup
  useEffect(() => {
    fetch('http://localhost:4000/api/health')
      .then(res => res.json())
      .then(data => {
        if (data && data.model) {
          setActiveModel(data.model);
        }
      })
      .catch(err => {
        console.warn('Could not fetch active model from health check.', err);
      });
  }, []);

  // Scroll chat history to bottom
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [sessions, currentSessionId, uiState]);

  // Handle TTS state reflection to UI State
  useEffect(() => {
    if (tts.isPlaying) {
      if (tts.isPaused) {
        setUiState('Idle');
        setStatusLabel('Paused');
      } else {
        setUiState('Speaking');
        setStatusLabel('Speaking...');
      }
    } else {
      setUiState('Idle');
      setStatusLabel('Ready');
    }
  }, [tts.isPlaying, tts.isPaused]);

  // Set UI State and status text
  const updateUIState = (state, label = '') => {
    setUiState(state);
    setStatusLabel(label || state);
  };

  const filteredSessions = sessions.filter(s => {
    const queryText = archiveSearch.toLowerCase();
    const titleMatch = s.title.toLowerCase().includes(queryText);
    const urlMatch = s.pageContent && s.pageContent.url && s.pageContent.url.toLowerCase().includes(queryText);
    return titleMatch || urlMatch;
  });

  const archivePreviewSession = sessions.find(s => s.id === selectedArchiveId) || null;

  // Create a new chat session
  const handleNewChat = () => {
    const newSession = {
      id: Date.now(),
      title: `Session ${sessions.length + 1}`,
      messages: [{ role: 'assistant', content: 'MOMENTUM OS CHANNEL RESET. STANDING BY FOR INPUT.' }],
      pageContent: null,
      targetLanguage: 'English (US)',
      activeIntent: 'SUMMARIZE',
      intentResponses: {
        SUMMARIZE: 'SYSTEM LOG: Awaiting page extraction. Click "Extract Page" below to compile context.',
        EXPLAIN_SIMPLE: 'SYSTEM LOG: ELI5 explanation cache is empty. Extract context first.',
        EXAMPLE: 'SYSTEM LOG: Topic illustration compiler is offline. Extract context first.',
      }
    };
    const updated = [newSession, ...sessions];
    saveSessionsToStorage(updated, newSession.id);
    currentSessionIdRef.current = newSession.id;
    setCurrentSessionId(newSession.id);
    setIsSidebarActive(false);
  };

  // Switch to selected session
  const handleSwitchSession = (sessionId) => {
    currentSessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastSessionId: sessionId });
    } else {
      localStorage.setItem('lastSessionId', sessionId.toString());
    }
  };

  // Delete an old chat session
  const handleDeleteSession = (sessionId) => {
    if (sessions.length <= 1) {
      alert("Cannot delete the only remaining session.");
      return;
    }
    const updated = sessions.filter(s => s.id !== sessionId);
    let nextActiveId = currentSessionId;
    if (currentSessionId === sessionId) {
      nextActiveId = updated[0].id;
    }
    saveSessionsToStorage(updated, nextActiveId);
    setCurrentSessionId(nextActiveId);
    if (selectedArchiveId === sessionId) {
      setSelectedArchiveId(null);
    }
  };

  // Export chat transcript as Markdown document
  const exportSessionMarkdown = (s) => {
    const header = `# Chat Transcript: ${s.title}\n` +
      `* **Date:** ${new Date(s.id).toLocaleString()}\n` +
      (s.pageContent ? `* **Source Webpage:** ${s.pageContent.url}\n` : '') +
      `\n---\n\n`;
    
    const body = s.messages.map(msg => {
      const roleName = msg.role === 'user' ? 'User' : 'AI Companion';
      return `### **${roleName}**:\n${msg.content}\n\n`;
    }).join('---\n\n');

    const blob = new Blob([header + body], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_transcript.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Lazy Extract + Intent Trigger Action
  const handleIntentAction = (intentType) => {
    const active = getActiveSession();
    if (!active) return;

    if (!active.pageContent) {
      updateUIState('Thinking', 'Extracting...');
      startTimer();

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'TRIGGER_EXTRACTION' }, (response) => {
          stopTimer();
          if (response && response.status === 'success') {
            active.pageContent = response.data;
            active.title = response.data.title;
            active.messages.push({
              role: 'assistant',
              content: `📖 EXTRACTED CONTEXT FROM "${response.data.title.toUpperCase()}" SUCCESSFUL. WORD COUNT: ${response.data.wordCount}.`
            });
            const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? active : s);
            saveSessionsToStorage(updated, currentSessionIdRef.current);
            triggerIntentFetch(response.data, intentType);
          } else {
            updateUIState('Error', 'Extraction failed');
          }
        });
      } else {
        // mock logic
        setTimeout(() => {
          stopTimer();
          const mockData = {
            url: window.location.href,
            title: 'Steam Operational Manifesto',
            textContent: 'Centralized gaming analytics compilation covering operational revision 4.0.12 parameters.',
            wordCount: 11,
            extractionMethod: 'mock-dom',
            truncated: false
          };
          active.pageContent = mockData;
          active.title = mockData.title;
          active.messages.push({
            role: 'assistant',
            content: `📖 [MOCK ACCESSED] COMPILING "${mockData.title.toUpperCase()}" DATA STREAM.`
          });
          const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? active : s);
          saveSessionsToStorage(updated, currentSessionIdRef.current);
          triggerIntentFetch(mockData, intentType);
        }, 800);
      }
    } else {
      triggerIntentFetch(active.pageContent, intentType);
    }
  };

  // EXTRACT PAGE content
  const handleExtract = () => {
    updateUIState('Thinking', 'Extracting...');
    startTimer();

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'TRIGGER_EXTRACTION' }, (response) => {
        if (response && response.status === 'success') {
          stopTimer();
          updateUIState('Idle', 'Ready');
          
          const active = getActiveSession();
          if (active) {
            active.pageContent = response.data;
            active.title = response.data.title;
            active.messages.push({
              role: 'assistant',
              content: `📖 EXTRACTED CONTEXT FROM "${response.data.title.toUpperCase()}" SUCCESSFUL. WORD COUNT: ${response.data.wordCount}.`
            });
            const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? active : s);
            saveSessionsToStorage(updated, currentSessionIdRef.current);
          }
        } else {
          stopTimer();
          updateUIState('Error', 'Failed');
          const errorMsg = response ? response.message : 'Unknown error';
          const active = getActiveSession();
          if (active) {
            active.messages.push({
              role: 'assistant',
              content: `CRITICAL ERROR: CONTEXT EXTRACTION FAILED (${errorMsg.toUpperCase()}). REFRESH SYSTEM CHANNEL.`
            });
            const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? active : s);
            saveSessionsToStorage(updated, currentSessionIdRef.current);
          }
        }
      });
    } else {
      // Mock for local browser development
      setTimeout(() => {
        stopTimer();
        updateUIState('Idle', 'Ready');
        const mockData = {
          url: window.location.href,
          title: 'Steam Operational Manifesto',
          textContent: 'Centralized gaming analytics compilation covering operational revision 4.0.12 parameters.',
          wordCount: 11,
          extractionMethod: 'mock-dom',
          truncated: false
        };
        const active = getActiveSession();
        if (active) {
          active.pageContent = mockData;
          active.title = mockData.title;
          active.messages.push({
            role: 'assistant',
            content: `📖 [MOCK ACCESSED] COMPILING "${mockData.title.toUpperCase()}" DATA STREAM.`
          });
          const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? active : s);
          saveSessionsToStorage(updated, currentSessionIdRef.current);
        }
      }, 800);
    }
  };

  // Helper to convert ArrayBuffer to Base64
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Helper to extract text from PDF via backend parser
  const extractTextFromPDF = async (arrayBuffer) => {
    const base64 = arrayBufferToBase64(arrayBuffer);
    const response = await fetch('http://localhost:4000/api/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData: base64 })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${response.status}`);
    }
    const data = await response.json();
    return data.text;
  };

  // File Upload Handler (Text & PDF support)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    updateUIState('Thinking', 'Reading file...');
    startTimer();

    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          const text = await extractTextFromPDF(arrayBuffer);
          
          stopTimer();
          updateUIState('Idle', 'Ready');

          if (!text.trim()) {
            throw new Error("No text content could be extracted from this PDF.");
          }

          const fileContent = {
            url: `file://${file.name}`,
            title: file.name,
            textContent: text,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            extractionMethod: 'file-upload',
            truncated: false
          };

          const active = getActiveSession();
          if (active) {
            active.title = file.name;
            active.pageContent = fileContent;
            active.messages.push({
              role: 'assistant',
              content: `📎 SYSTEM ATTACHMENT INDEXED: "${file.name.toUpperCase()}" (${fileContent.wordCount} words). AWAITING QUERIES.`
            });
            const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? active : s);
            saveSessionsToStorage(updated, currentSessionIdRef.current);
          }
        } catch (error) {
          stopTimer();
          updateUIState('Error', 'Failed to read PDF');
          console.error('[PDF Read Error]', error);
          const active = getActiveSession();
          if (active) {
            active.messages.push({
              role: 'assistant',
              content: `CRITICAL ERROR: Failed to parse PDF file "${file.name}". Ensure it is a valid, readable text document.`
            });
            const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? active : s);
            saveSessionsToStorage(updated, currentSessionIdRef.current);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Plain text reader fallback
      const reader = new FileReader();
      reader.onload = (event) => {
        stopTimer();
        updateUIState('Idle', 'Ready');
        const text = event.target.result;
        const fileContent = {
          url: `file://${file.name}`,
          title: file.name,
          textContent: text,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          extractionMethod: 'file-upload',
          truncated: false
        };

        const active = getActiveSession();
        if (active) {
          active.title = file.name;
          active.pageContent = fileContent;
          active.messages.push({
            role: 'assistant',
            content: `📎 SYSTEM ATTACHMENT INDEXED: "${file.name.toUpperCase()}" (${fileContent.wordCount} words). AWAITING QUERIES.`
          });
          const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? active : s);
          saveSessionsToStorage(updated, currentSessionIdRef.current);
        }
      };
      reader.readAsText(file);
    }
  };

  // Fetch specific intent data from API
  const triggerIntentFetch = (pageData, intentType) => {
    if (intentType === 'SUMMARIZE') {
      startTimer();
      updateUIState('Thinking', 'Thinking...');
    }

    const active = getActiveSession();
    const payload = {
      pageContent: pageData,
      history: [],
      userQuery: getQueryPrompt(intentType),
      intent: intentType,
      targetLanguage: active ? active.targetLanguage : targetLanguage
    };

    const handleSuccess = (text) => {
      const activeS = getActiveSession();
      if (activeS) {
        activeS.intentResponses[intentType] = text;
        
        // If it's the SUMMARIZE intent, append it directly to the chat log
        if (intentType === 'SUMMARIZE') {
          activeS.messages.push({
            role: 'assistant',
            content: `📄 **SUMMARY REPORT:**\n\n${text}`
          });
        }

        const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? activeS : s);
        saveSessionsToStorage(updated, currentSessionIdRef.current);
        
        if (intentType === 'SUMMARIZE') {
          updateUIState('Idle', 'Ready');
          stopTimer();
          setGenerationTime(timerVal);
        }
      }
    };

    const handleFailure = (errorMsg) => {
      const activeS = getActiveSession();
      if (activeS) {
        const errorText = `CRITICAL DECODE FAULT inside ${intentType}: ${errorMsg.toUpperCase()}`;
        activeS.intentResponses[intentType] = errorText;

        if (intentType === 'SUMMARIZE') {
          activeS.messages.push({
            role: 'assistant',
            content: `⚠️ Failed to generate summary: ${errorMsg}`
          });
        }

        const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? activeS : s);
        saveSessionsToStorage(updated, currentSessionIdRef.current);

        if (intentType === 'SUMMARIZE') {
          updateUIState('Error', 'Failed');
          stopTimer();
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'USER_QUERY', payload }, (response) => {
        if (chrome.runtime.lastError) {
          handleFailure(chrome.runtime.lastError.message);
          return;
        }
        if (response && response.status === 'success') {
          handleSuccess(response.data.text);
        } else {
          handleFailure(response ? response.message : 'Unknown error');
        }
      });
    } else {
      // Standalone webpage mode: direct HTTP fetch to backend server
      const BACKEND_URL = 'http://localhost:4000';
      const endpoint = intentType === 'SUMMARIZE' ? `${BACKEND_URL}/api/summarize` : `${BACKEND_URL}/api/query`;
      
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(responseData => handleSuccess(responseData.text))
      .catch(err => handleFailure(err.message));
    }
  };

  const getQueryPrompt = (intent) => {
    if (intent === 'SUMMARIZE') return 'Summarize the webpage context.';
    if (intent === 'EXPLAIN_SIMPLE') return 'Explain this page simply like I am 5.';
    if (intent === 'EXAMPLE') return 'Give an illustrative example of this topic.';
    return '';
  };

  // SEND MESSAGE (FREEFORM QA)
  const handleSend = (textToSend = '') => {
    const queryStr = (typeof textToSend === 'string' && textToSend.trim()) ? textToSend : inputText;
    const query = (queryStr || '').trim();
    if (!query) return;

    setInputText('');
    
    // Check if voice control intent
    const voiceIntent = classifyIntent(query);
    if (voiceIntent === Intents.PAUSE) { tts.pause(); return; }
    if (voiceIntent === Intents.RESUME) { tts.resume(); return; }
    if (voiceIntent === Intents.STOP) { tts.stop(); return; }

    const active = getActiveSession();
    if (!active) return;

    active.messages.push({ role: 'user', content: query });
    active.activeIntent = 'FREEFORM_QA'; // Switch to Chat mode
    // Use sessionsRef to avoid stale closure
    const updatedWithUser = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? active : s);
    saveSessionsToStorage(updatedWithUser, currentSessionIdRef.current);

    updateUIState('Thinking', 'Thinking...');
    startTimer();

    const payload = {
      pageContent: active.pageContent,
      history: active.messages.filter(m => m.role !== 'system'),
      userQuery: query,
      intent: 'FREEFORM_QA',
      targetLanguage: active.targetLanguage
    };

    const handleResponse = (responseText) => {
      updateUIState('Speaking', 'Reading...');
      stopTimer();
      setGenerationTime(timerVal);
      const activeS = getActiveSession();
      if (activeS) {
        activeS.messages.push({ role: 'assistant', content: responseText });
        const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? activeS : s);
        saveSessionsToStorage(updated, currentSessionIdRef.current);
        tts.speak(responseText, getLangCode(activeS.targetLanguage));
      }
    };

    const handleError = (errorMsg) => {
      updateUIState('Error', 'API Error');
      stopTimer();
      const activeS = getActiveSession();
      if (activeS) {
        activeS.messages.push({ role: 'assistant', content: `Error: ${errorMsg}` });
        const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? activeS : s);
        saveSessionsToStorage(updated, currentSessionIdRef.current);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'USER_QUERY', payload }, (response) => {
        if (chrome.runtime.lastError) {
          handleError(chrome.runtime.lastError.message);
          return;
        }
        if (response && response.status === 'success') {
          handleResponse(response.data.text);
        } else {
          handleError(response ? response.message : 'Unknown error');
        }
      });
    } else {
      // Standalone webpage mode: direct HTTP fetch to backend server
      const BACKEND_URL = 'http://localhost:4000';
      fetch(`${BACKEND_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(responseData => handleResponse(responseData.text))
      .catch(err => handleError(err.message));
    }
  };

  // MIC EVENT
  const handleMicToggle = () => {
    const active = getActiveSession();
    if (!active) return;

    if (stt.isListening) {
      // User manually stops mic
      stt.stopListening();
      updateUIState('Idle', 'Ready');
    } else {
      tts.stop(); // Stop any active TTS before recording
      updateUIState('Listening', 'Listening...');

      stt.startListening(
        getLangCode(active.targetLanguage),

        // onInterim: show live transcript in input box as user speaks
        (interimText) => {
          setInputText(interimText);
        },

        // onFinalResult: auto-send the committed final transcript
        (finalText) => {
          if (finalText.trim()) {
            setInputText(finalText);
            handleSend(finalText);
          }
          updateUIState('Idle', 'Ready');
        },

        // onEnd: clean up state
        () => {
          updateUIState('Idle', 'Ready');
        },

        // onError: show friendly message in chat
        (err) => {
          console.error('[STT error]', err);
          updateUIState('Idle', 'Ready');
          
          const isPermissionError = err.message.toLowerCase().includes('permission') || 
                                    err.message.toLowerCase().includes('not-allowed') || 
                                    err.message.toLowerCase().includes('allow') ||
                                    err.message.toLowerCase().includes('denied');
          
          const activeS = getActiveSession();
          if (activeS) {
            let msgContent = `🎙️ Microphone error: ${err.message}`;
            if (isPermissionError && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              msgContent = `🎙️ MICROPHONE PERMISSION REQUIRED: Google Chrome blocks permission prompts inside popup side panels. \n\nI have automatically opened a permission tab for you. Please click "Allow" on the browser prompt there, then close that tab and return here!`;
              chrome.tabs.create({ url: chrome.runtime.getURL("popup/index.html?request_mic=true") });
            }
            
            activeS.messages.push({
              role: 'assistant',
              content: msgContent
            });
            const updated = sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? activeS : s);
            saveSessionsToStorage(updated, currentSessionIdRef.current);
          }
        }
      );
    }
  };

  // Open Full-Page Dashboard Tab
  const handleOpenDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup/index.html") });
    } else {
      alert("Running in standalone web view.");
    }
  };

  // Parse lines to display as bullet points (for Summarize/Explain/Example)
  const getRenderContent = () => {
    const active = getActiveSession();
    if (!active) return [];
    
    const text = active.intentResponses[active.activeIntent] || '';
    const lines = text.split('\n')
      .map(line => line.replace(/^[\s*\-•]+/g, '').trim())
      .filter(line => line.length > 0);
      
    if (lines.length === 0) {
      return [<li key="0" className="bullet-item">{text}</li>];
    }
    return lines.map((line, idx) => (
      <li key={idx} className="bullet-item">{line}</li>
    ));
  };

  const renderThinkingState = () => {
    return (
      <div className="thinking-container">
        <div className="thinking-header">
          <span className="thinking-brain">🤖</span>
          <span>COMPILING DECODE STREAM... (⏱️ {timerVal}s)</span>
        </div>
        <div className="skeleton-card">
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
        </div>
      </div>
    );
  };

  const renderExtractionState = () => {
    return (
      <div className="thinking-container">
        <div className="thinking-header">
          <span className="thinking-brain">🔍</span>
          <span>COMPILING DOM ELEMENTS... (⏱️ {timerVal}s)</span>
        </div>
        <div className="skeleton-card">
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
        </div>
      </div>
    );
  };

  const activeSession = getActiveSession();

  if (hasConsent === false) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        background: '#0c0d0e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#f8fafc',
        fontFamily: "'Outfit', sans-serif",
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>MOMENTUM OS // PRIVACY PERMIT</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
          This companion reads the text content of your active tab <strong>only</strong> when you explicitly trigger an extraction. We do not store your browsing history.
        </p>
        <button 
          onClick={handleAcceptConsent}
          style={{
            padding: '12px 28px',
            borderRadius: '0px',
            border: '2px solid #000',
            background: '#d90429',
            color: '#fff',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(217, 4, 41, 0.3)'
          }}
        >
          ACCEPT PERMIT
        </button>
      </div>
    );
  }

  if (hasConsent === null) return null;

  if (!isWebMode) {
    return (
      <div className="botpenguin-container">
        {/* Blue Header */}
        <header className="bp-header">
          <div className="bp-header-left">
            <span className="bp-logo">🐧</span>
            <span className="bp-title">AI Companion</span>
            <span 
              className="bp-badge" 
              onClick={() => setShowModelHub(!showModelHub)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
              title="Click to view Model Hub"
            >
              {activeModel} ▾
            </span>
          </div>
          <div className="bp-header-right">
            {/* 🌐 Language Selector */}
            <div style={{ position: 'relative', display: 'inline-block', ref: langRef }}>
              <button 
                className="bp-header-btn" 
                title="Select Language" 
                onClick={() => setIsLangOpen(!isLangOpen)}
                style={{ marginRight: '6px', fontSize: '13px' }}
              >
                🌐
              </button>
              {isLangOpen && (
                <div style={{
                  position: 'absolute',
                  top: '28px',
                  right: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  zIndex: 300,
                  width: '140px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px 0'
                }}>
                  {['English (US)', 'English (UK)', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Odia', 'Urdu', 'Sanskrit'].map(lang => (
                    <div 
                      key={lang} 
                      onClick={() => {
                        if (activeSession) {
                          activeSession.targetLanguage = lang;
                          saveSessionsToStorage(sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? activeSession : s), currentSessionIdRef.current);
                        }
                        setIsLangOpen(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        backgroundColor: activeSession && activeSession.targetLanguage === lang ? '#f1f5f9' : 'transparent',
                        color: activeSession && activeSession.targetLanguage === lang ? '#007bff' : '#334155',
                        fontWeight: activeSession && activeSession.targetLanguage === lang ? '700' : 'normal',
                        textAlign: 'left'
                      }}
                    >
                      {lang}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* 💬 History Toggle */}
            <button className="bp-header-btn" title="Saved Conversations" onClick={() => setIsHistoryOpen(!isHistoryOpen)} style={{ marginRight: '6px' }}>
              💬
            </button>
            {/* 🔄 Extract Page */}
            <button className="bp-header-btn" title="Extract current tab page content" onClick={handleExtract} style={{ marginRight: '6px' }}>
              🔄
            </button>
            {/* 🖥️ Open Full Dashboard */}
            <button className="bp-header-btn" title="Open Full Dashboard" onClick={handleOpenDashboard}>
              🖥️
            </button>
            <button className="bp-header-btn" title="Close" onClick={() => window.close()}>
              ×
            </button>
          </div>
        </header>

        {/* Global TTS Audio Control Bar */}
        {(tts.isPlaying || tts.isPaused) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#e2e8f0',
            borderBottom: '1px solid #cbd5e1',
            padding: '6px 12px',
            fontSize: '11.5px',
            color: '#334155',
            fontFamily: 'var(--font-sans)',
            animation: 'fadeIn 0.2s',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔊</span>
              <strong>{tts.isPaused ? 'Speech Paused' : 'Speaking response...'}</strong>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {tts.isPaused ? (
                <button 
                  onClick={tts.resume} 
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                  title="Play / Resume"
                >
                  ▶️ Play
                </button>
              ) : (
                <button 
                  onClick={tts.pause} 
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                  title="Pause"
                >
                  ⏸️ Pause
                </button>
              )}
              <button 
                onClick={tts.stop} 
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                title="Stop"
              >
                ⏹️ Stop
              </button>
            </div>
          </div>
        )}

        {/* Model suggestions overlay for extension mode */}
        {showModelHub && (
          <div style={{
            position: 'absolute',
            top: '50px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#ffffff',
            zIndex: 200,
            padding: '16px',
            fontFamily: "var(--font-sans)",
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>🤖 Local Model Hub</span>
              <button 
                onClick={() => setShowModelHub(false)}
                style={{ border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            
            {/* Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: backendStatus === 'online' ? '#10b981' : '#ef4444'
              }}></span>
              <span style={{ fontWeight: 600, color: backendStatus === 'online' ? '#10b981' : '#ef4444' }}>
                Ollama: {backendStatus === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>

            {backendStatus === 'offline' && (
              <div style={{ fontSize: '11px', color: '#991b1b', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '10px', borderRadius: '6px' }}>
                Ollama is offline. Start it by running <strong>ollama serve</strong> in terminal.
              </div>
            )}

            {/* List of active models */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Available local models</span>
              {downloadedModels.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>No local models downloaded yet.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {downloadedModels.map(m => (
                    <span key={m} style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      backgroundColor: m.includes(activeModel) ? '#e0f2fe' : '#f1f5f9',
                      border: '1px solid',
                      borderColor: m.includes(activeModel) ? '#bae6fd' : '#e2e8f0',
                      color: m.includes(activeModel) ? '#0369a1' : '#475569',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}>
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Recommended models */}
            <div style={{ marginTop: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Recommended Models</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { name: 'llama3.1:8b', size: '4.7GB' },
                  { name: 'phi3:latest', size: '2.2GB' },
                  { name: 'gemma2:2b', size: '1.6GB' }
                ].map(rec => {
                  const isDownloaded = downloadedModels.some(dm => dm.includes(rec.name));
                  return (
                    <div key={rec.name} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                      padding: '8px 10px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        {rec.name} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '10.5px' }}>({rec.size})</span>
                      </span>
                      {isDownloaded ? (
                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>✅ OK</span>
                      ) : (
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`ollama run ${rec.name}`);
                            alert(`Pull command copied! Run this in your terminal to install: \n\nollama run ${rec.name}`);
                          }}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: '#3b82f6',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Copy Pull
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Collapsible History Drawer */}
        {isHistoryOpen && (
          <div style={{
            position: 'absolute',
            top: '50px',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            zIndex: 100,
            maxHeight: '260px',
            overflowY: 'auto',
            padding: '12px',
            fontFamily: "var(--font-sans)",
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Saved Chats</span>
              <button 
                onClick={() => {
                  handleNewChat();
                  setIsHistoryOpen(false);
                }}
                style={{ 
                  backgroundColor: '#007bff', 
                  color: '#ffffff', 
                  border: 'none', 
                  borderRadius: '4px', 
                  padding: '3px 8px', 
                  fontSize: '10.5px', 
                  fontWeight: 600, 
                  cursor: 'pointer' 
                }}
              >
                + New Chat
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {sessions.map(s => (
                <div 
                  key={s.id} 
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: s.id === currentSessionId ? 'rgba(0, 123, 255, 0.08)' : '#f8fafc',
                    border: '1px solid',
                    borderColor: s.id === currentSessionId ? 'rgba(0, 123, 255, 0.2)' : '#e2e8f0',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => {
                    handleSwitchSession(s.id);
                    setIsHistoryOpen(false);
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: s.id === currentSessionId ? '#007bff' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.title}
                  </span>
                  {s.pageContent && s.pageContent.url && (
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      🔗 {new URL(s.pageContent.url).hostname}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Body */}
        <main className="bp-chat-body" ref={chatHistoryRef}>
          <div className="bp-chat-history">
            {/* Welcome messages if empty */}
            {activeSession && activeSession.messages.length <= 1 && (
              <>
                <div className="bp-msg-row assistant">
                  <div className="bp-avatar">🐧</div>
                  <div className="bp-msg-bubble">
                    Hi! Welcome to your AI Browser Companion.
                  </div>
                </div>
                <div className="bp-msg-row assistant">
                  <div className="bp-avatar">🐧</div>
                  <div className="bp-msg-bubble" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '280px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, lineHeight: 1.4 }}>
                      To start asking questions about this page, let's extract its content or attach a document:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                      <button 
                        onClick={handleExtract}
                        style={{
                          padding: '7px 12px',
                          backgroundColor: '#007bff',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(0, 123, 255, 0.2)'
                        }}
                      >
                        ⚡ Extract Active Webpage
                      </button>
                      <button 
                        onClick={() => fileInputRef.current.click()}
                        style={{
                          padding: '7px 12px',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        📎 Attach PDF / Document
                      </button>
                    </div>
                  </div>
                </div>
                {/* Quick suggestion chips */}
                <div className="bp-chips-container">
                  <button className="bp-chip" onClick={() => handleIntentAction('SUMMARIZE')}>
                    📝 Summarize Page
                  </button>
                  <button className="bp-chip" onClick={() => handleIntentAction('EXPLAIN_SIMPLE')}>
                    👁️ Explain Simply
                  </button>
                  <button className="bp-chip" onClick={() => handleIntentAction('EXAMPLE')}>
                    📂 Generate Example
                  </button>
                </div>
              </>
            )}

            {/* Render active chat messages */}
            {activeSession && activeSession.messages.map((msg, index) => {
              if (index === 0 && activeSession.messages.length > 1 && msg.content.includes("MOMENTUM OS")) return null;
              
              return (
                <div key={index} className={`bp-msg-row ${msg.role}`}>
                  {msg.role === 'assistant' && <div className="bp-avatar">🐧</div>}
                  <div className="bp-msg-bubble" style={{ position: 'relative', paddingRight: msg.role === 'assistant' ? '28px' : '12px' }}>
                    {msg.content}
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => tts.speak(msg.content.replace(/[#*`_]/g, ''), getLangCode(activeSession.targetLanguage))}
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          right: '6px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '12px',
                          opacity: 0.6,
                          padding: 0
                        }}
                        title="Read aloud"
                      >
                        🔊
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking loader */}
            {uiState === 'Thinking' && (
              <div className="bp-msg-row assistant">
                <div className="bp-avatar">🐧</div>
                <div className="bp-msg-bubble loading">
                  <span className="bp-dot-loader"></span>
                  <span className="bp-dot-loader"></span>
                  <span className="bp-dot-loader"></span>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Input Row */}
        <footer className="bp-input-footer">
          {/* 🔄 Extract Page Icon Button */}
          <button className="bp-btn-send" onClick={handleExtract} title="Extract current tab page content" style={{ marginRight: '2px', color: '#007bff' }}>
            🔄
          </button>
          <input 
            type="text" 
            className="bp-input-field" 
            placeholder={stt.isListening ? "Listening..." : "Ask anything about this page..."} 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          {/* 🎙️ Voice Input Button */}
          {stt.isSupported !== false && (
            <button 
              className="bp-btn-send" 
              onClick={handleMicToggle} 
              title={stt.isListening ? "Click to stop recording" : "Click to speak"}
              style={{ 
                marginRight: '4px', 
                color: stt.isListening ? '#ef4444' : '#64748b',
                animation: stt.isListening ? 'mic-pulse 1s infinite' : 'none',
                position: 'relative'
              }}
            >
              {stt.isListening ? '🔴' : '🎙️'}
            </button>
          )}
          <button className="bp-btn-send" onClick={handleSend} title="Send message">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="messenger-container">
      {/* Left Sidebar */}
      <aside className="ms-left-sidebar">
        <div className="ms-logo-area">
          <div className="ms-logo-dot"></div>
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#2b3a4a', fontFamily: 'var(--font-sans)' }}>AI COMPANION</h2>
        </div>
        
        <button className="btn-create-new" onClick={handleNewChat}>
          📝 Create New
        </button>

        <ul className="ms-nav-list">
          <li className={`ms-nav-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
            💬 Conversations
          </li>
          <li className={`ms-nav-item ${activeTab === 'archive' ? 'active' : ''}`} onClick={() => setActiveTab('archive')}>
            📜 Chat Archive
          </li>
          <li className={`ms-nav-item ${activeTab === 'models' ? 'active' : ''}`} onClick={() => setActiveTab('models')}>
            🤖 Model Hub
          </li>
          <li className="ms-nav-item" onClick={() => setShowHelp(!showHelp)}>
            ❓ Operator Help
          </li>
          <li className="ms-nav-item" onClick={handleExtract}>
            ⚡ Extract Page
          </li>
        </ul>

        <div style={{ marginTop: 'auto', borderTop: '1px solid #e9ecef', paddingTop: '16px' }}>
          <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#7c8ba1', textTransform: 'uppercase', marginBottom: '8px' }}>Saved Chats</h4>
          <div className="session-list-ms" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sessions.map(s => (
              <div 
                key={s.id} 
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: s.id === currentSessionId ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                  border: '1px solid',
                  borderColor: s.id === currentSessionId ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: s.id === currentSessionId ? '#3b82f6' : '#555555',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => handleSwitchSession(s.id)}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.title}
                </span>
                {s.pageContent && s.pageContent.url && (
                  <span style={{ fontSize: '10px', color: '#888888', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    🔗 {new URL(s.pageContent.url).hostname}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {activeTab === 'archive' ? (
        <>
          {/* Middle Archive Panel */}
          <main className="ms-chat-panel" style={{ flex: 1.5, borderRight: '1px solid #e9ecef' }}>
            <header className="ms-chat-header">
              <div>
                <div className="ms-chat-title">📜 Conversation Archive</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Search and manage your saved chat history</div>
              </div>
            </header>
            
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
              {/* Search Bar */}
              <input 
                type="text"
                placeholder="🔍 Search conversations by title or webpage URL..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              />

              {/* Grid of Conversations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredSessions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                    <div style={{ fontWeight: 600 }}>No conversations found</div>
                  </div>
                ) : (
                  filteredSessions.map(s => (
                    <div 
                      key={s.id}
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: selectedArchiveId === s.id ? 'rgba(59, 130, 246, 0.04)' : '#ffffff',
                        border: '1px solid',
                        borderColor: selectedArchiveId === s.id ? '#3b82f6' : '#e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setSelectedArchiveId(s.id)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '75%' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.title}
                        </span>
                        {s.pageContent && s.pageContent.url && (
                          <span style={{ fontSize: '11px', color: '#3b82f6', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🔗 {s.pageContent.url}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          💬 {s.messages.length} messages • ⏱️ {new Date(s.id).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            handleSwitchSession(s.id);
                            setActiveTab('chat');
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Open Chat
                        </button>
                        <button 
                          onClick={() => handleDeleteSession(s.id)}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>

          {/* Right Preview Panel */}
          <aside className="ms-right-sidebar" style={{ flex: 1.2, padding: '20px', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>
              Transcript Preview
            </h3>
            
            {archivePreviewSession ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px', maxHeight: 'calc(100vh - 180px)' }}>
                  {archivePreviewSession.messages.map((msg, index) => (
                    <div key={index} style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: msg.role === 'user' ? '#e0f2fe' : '#ffffff',
                      border: '1px solid #e2e8f0',
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%'
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: msg.role === 'user' ? '#0369a1' : '#475569', marginBottom: '2px', textTransform: 'uppercase' }}>
                        {msg.role === 'user' ? 'User' : 'Assistant'}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#1e293b', lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => exportSessionMarkdown(archivePreviewSession)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    📥 Export Markdown
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👁️</div>
                <p style={{ fontSize: '12px' }}>Select a conversation to preview its transcript</p>
              </div>
            )}
          </aside>
        </>
      ) : activeTab === 'models' ? (
        <>
          {/* Middle Models Hub Panel */}
          <main className="ms-chat-panel" style={{ flex: 1.5, borderRight: '1px solid #e9ecef' }}>
            <header className="ms-chat-header">
              <div>
                <div className="ms-chat-title">🤖 Local Model Hub</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Check health, active models, and suggestions</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  backgroundColor: backendStatus === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: backendStatus === 'online' ? '#10b981' : '#ef4444'
                }}>
                  {backendStatus === 'online' ? '● Ollama Online' : '● Ollama Offline'}
                </span>
              </div>
            </header>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
              {/* Ollama Offline Banner */}
              {backendStatus === 'offline' && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '13px'
                }}>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>⚠️ Ollama is Offline</strong>
                  Make sure Ollama is installed and running on your computer. Start it by opening your terminal and running:
                  <pre style={{
                    backgroundColor: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #fca5a5',
                    marginTop: '8px',
                    fontSize: '12.5px',
                    fontFamily: 'var(--font-mono)'
                  }}>ollama serve</pre>
                </div>
              )}

              {/* Downloaded Models */}
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>Downloaded Models</h3>
                {downloadedModels.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8', padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '6px', textAlign: 'center' }}>
                    No downloaded models found. Start Ollama or check your connection.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {downloadedModels.map(m => (
                      <span key={m} style={{
                        padding: '6px 12px',
                        backgroundColor: m.includes(activeModel) ? '#e0f2fe' : '#f1f5f9',
                        border: '1px solid',
                        borderColor: m.includes(activeModel) ? '#bae6fd' : '#e2e8f0',
                        color: m.includes(activeModel) ? '#0369a1' : '#475569',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: 600
                      }}>
                        {m} {m.includes(activeModel) && '⭐'}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommended Models */}
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>Recommended Models</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { name: 'llama3.1:8b', size: '4.7 GB', desc: 'Highly recommended for detailed reasoning and code companion tasks.' },
                    { name: 'phi3:latest', size: '2.2 GB', desc: 'Microsoft lightweight 3.8B model. Super fast, perfect for summaries.' },
                    { name: 'gemma2:2b', size: '1.6 GB', desc: 'Google lightweight 2B model. Fast and highly structured.' },
                    { name: 'qwen2.5:7b', size: '4.7 GB', desc: 'Alibaba robust multilingual model. Strong in general instructions.' },
                    { name: 'mistral:latest', size: '4.1 GB', desc: 'Solid general instruction-following 7B model.' }
                  ].map(rec => {
                    const isDownloaded = downloadedModels.some(dm => dm.includes(rec.name));
                    return (
                      <div key={rec.name} style={{
                        padding: '14px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>
                            {rec.name} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>({rec.size})</span>
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>{rec.desc}</span>
                        </div>
                        <div>
                          {isDownloaded ? (
                            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              ✅ Available
                            </span>
                          ) : (
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(`ollama run ${rec.name}`);
                                alert(`Command copied! Paste this in your terminal to install: \n\nollama run ${rec.name}`);
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#3b82f6',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Copy Command
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </main>

          {/* Right Preview Panel */}
          <aside className="ms-right-sidebar" style={{ flex: 1.2, padding: '20px', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>
              Ollama Guide
            </h3>
            <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>Ollama runs LLMs locally on your own hardware. Your chats never leave your machine.</p>
              <h4 style={{ fontWeight: 700, color: '#1e293b', marginTop: '6px' }}>How to Use a Model:</h4>
              <ol style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Install Ollama from <a href="https://ollama.com" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>ollama.com</a>.</li>
                <li>Open your Terminal or Command Prompt.</li>
                <li>Run the copy-pasteable pull command.</li>
                <li>Once the pull completes, our dashboard will automatically detect it!</li>
              </ol>
            </div>
          </aside>
        </>
      ) : (
        <>
          {/* Middle Main Chat Panel */}
          <main className="ms-chat-panel">
            <header className="ms-chat-header">
              <div className="ms-chat-title-wrapper">
                <div className="ms-avatar-circle" style={{ width: '32px', height: '32px', backgroundColor: '#3b82f6', color: '#ffffff', fontWeight: 700, fontSize: '12px' }}>
                  AI
                </div>
                <div>
                  <div className="ms-chat-title">{activeSession ? activeSession.title : 'New Chat Session'}</div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>Active Connection</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Language Selector */}
                {activeSession && (
                  <div className="intent-selector" ref={langRef}>
                    <button 
                      className="lang-btn" 
                      onClick={() => setIsLangOpen(!isLangOpen)}
                      style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', borderRadius: '6px', fontSize: '11px', height: '32px' }}
                    >
                      🌐 {activeSession.targetLanguage} ▾
                    </button>
                    {isLangOpen && (
                      <div className="lang-dropdown-menu" style={{ right: 0, maxHeight: '200px', overflowY: 'auto' }}>
                        {['English (US)', 'English (UK)', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Odia', 'Urdu', 'Sanskrit'].map(lang => (
                          <div 
                            key={lang} 
                            onClick={() => {
                              activeSession.targetLanguage = lang;
                              saveSessionsToStorage(sessionsRef.current.map(s => s.id === currentSessionIdRef.current ? activeSession : s), currentSessionIdRef.current);
                              setIsLangOpen(false);
                            }}
                            className={`dropdown-item ${activeSession.targetLanguage === lang ? 'active' : ''}`}
                          >
                            {lang}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <span className="ms-model-badge">{activeModel.toUpperCase()}</span>
              </div>
            </header>

            {/* Global TTS Audio Control Bar for Webpage */}
            {(tts.isPlaying || tts.isPaused) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#e2e8f0',
                borderBottom: '1px solid #cbd5e1',
                padding: '8px 16px',
                fontSize: '12px',
                color: '#334155',
                fontFamily: 'var(--font-sans)',
                animation: 'fadeIn 0.2s',
                zIndex: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔊</span>
                  <strong>{tts.isPaused ? 'Speech Paused' : 'Speaking response...'}</strong>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {tts.isPaused ? (
                    <button 
                      onClick={tts.resume} 
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#3b82f6', padding: 0 }}
                      title="Play / Resume"
                    >
                      ▶️ Play
                    </button>
                  ) : (
                    <button 
                      onClick={tts.pause} 
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#3b82f6', padding: 0 }}
                      title="Pause"
                    >
                      ⏸️ Pause
                    </button>
                  )}
                  <button 
                    onClick={tts.stop} 
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#ef4444', padding: 0 }}
                    title="Stop"
                  >
                    ⏹️ Stop
                  </button>
                </div>
              </div>
            )}

            <div className="ms-chat-messages" ref={chatHistoryRef}>
              {showHelp ? (
                <div className="ms-msg-row assistant">
                  <div className="ms-avatar-circle" style={{ backgroundColor: '#e2e8f0' }}>🤖</div>
                  <div className="ms-bubble">
                    <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>AI Browser Companion Help</h3>
                    <p style={{ marginBottom: '8px' }}>This panel interfaces your browser tab with the local model <strong>{activeModel}</strong>.</p>
                    <p style={{ marginBottom: '8px' }}><strong>Instructions:</strong></p>
                    <ul style={{ paddingLeft: '16px', listStyleType: 'square' }}>
                      <li>Click "Extract Page" in the sidebar to load active webpage content.</li>
                      <li>Use the bottom input to chat about the extracted context.</li>
                    </ul>
                    <button className="btn-send-ms" style={{ marginTop: '12px', height: '30px' }} onClick={() => setShowHelp(false)}>Close Help</button>
                  </div>
                </div>
              ) : uiState === 'Thinking' ? (
                <div className="ms-msg-row assistant">
                  <div className="ms-avatar-circle" style={{ backgroundColor: '#e2e8f0' }}>🤖</div>
                  <div className="ms-bubble">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="bp-dot-loader"></span>
                      <span className="bp-dot-loader"></span>
                      <span className="bp-dot-loader"></span>
                      <span style={{ fontSize: '12px', color: '#777777', fontWeight: 600 }}>Decoding page elements...</span>
                    </div>
                  </div>
                </div>
              ) : activeSession && activeSession.messages.length > 0 ? (
                activeSession.messages.map((msg, index) => {
                  if (index === 0 && activeSession.messages.length > 1 && msg.content.includes("MOMENTUM OS")) return null;
                  return (
                    <div key={index} className={`ms-msg-row ${msg.role}`}>
                      <div className="ms-avatar-circle" style={{ backgroundColor: msg.role === 'user' ? '#3b82f6' : '#e2e8f0', color: msg.role === 'user' ? '#ffffff' : '#333333' }}>
                        {msg.role === 'user' ? 'U' : '🤖'}
                      </div>
                      <div className="ms-bubble" style={{ position: 'relative', paddingRight: msg.role === 'assistant' ? '32px' : '16px' }}>
                        {msg.content}
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => tts.speak(msg.content.replace(/[#*`_]/g, ''), getLangCode(activeSession.targetLanguage))}
                            style={{
                              position: 'absolute',
                              bottom: '6px',
                              right: '8px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '12px',
                              opacity: 0.6,
                              padding: 0
                            }}
                            title="Read aloud"
                          >
                            🔊
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#64748b' }}>No Messages Yet</h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>Extract a page or type a message below to begin.</p>
                </div>
              )}
            </div>

            {/* Bottom input area */}
            <footer className="ms-input-area">
              <div className="ms-input-capsule">
                <button 
                  className="btn-upload-ms" 
                  title="Upload file" 
                  onClick={() => fileInputRef.current.click()}
                >
                  📎
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".txt,.js,.css,.html,.md,.json,.csv,.pdf"
                  style={{ display: 'none' }}
                />
                <input 
                  type="text" 
                  className="ms-text-input" 
                  placeholder={stt.isListening ? "Listening..." : "Type a message..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                {/* 🎙️ Voice Input Button */}
                {stt.isSupported !== false && (
                  <button 
                    className="btn-upload-ms" 
                    onClick={handleMicToggle}
                    title={stt.isListening ? "Click to stop recording" : "Click to speak"}
                    style={{ 
                      fontSize: '18px', 
                      color: stt.isListening ? '#ef4444' : '#64748b', 
                      marginRight: '6px',
                      animation: stt.isListening ? 'mic-pulse 1s infinite' : 'none'
                    }}
                  >
                    {stt.isListening ? '🔴' : '🎙️'}
                  </button>
                )}
                <button className="btn-send-ms" onClick={handleSend}>
                  Send ➤
                </button>
              </div>
            </footer>
          </main>

          {/* Right Detail Sidebar */}
          <aside className="ms-right-sidebar">
            <div className="ms-profile-area">
              <div className="ms-profile-avatar">👨‍💻</div>
              <div className="ms-profile-name">Operator Console</div>
              <div className="ms-profile-title">Clearance Level: 1</div>
            </div>

            <div className="ms-panel-section">
              <h3 className="ms-section-label">Context Stats</h3>
              <div className="ms-stats-list">
                <div className="ms-stat-row">
                  <span className="ms-stat-name">Words Compiled</span>
                  <span className="ms-stat-value">
                    {activeSession && activeSession.pageContent ? activeSession.pageContent.wordCount.toLocaleString() : '0'}
                  </span>
                </div>
                <div className="ms-stat-row">
                  <span className="ms-stat-name">Speed Index</span>
                  <span className="ms-stat-value">{generationTime || timerVal}s</span>
                </div>
                <div className="ms-stat-row">
                  <span className="ms-stat-name">Local Model</span>
                  <span className="ms-stat-value">{activeModel.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div className="ms-panel-section" style={{ flex: 1 }}>
              <h3 className="ms-section-label">Extracted Materials</h3>
              <div className="ms-files-grid" style={{ overflowY: 'auto', maxHeight: '200px' }}>
                {activeSession && activeSession.pageContent ? (
                  <div className="ms-file-card">
                    <span className="ms-file-icon">📄</span>
                    <span className="ms-file-name" title={activeSession.title}>{activeSession.title}</span>
                  </div>
                ) : (
                  <div style={{ gridColumn: 'span 2', fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
                    No pages extracted.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export default App;

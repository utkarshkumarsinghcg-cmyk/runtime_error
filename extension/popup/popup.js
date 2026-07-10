/**
 * popup.js
 * 
 * Logic for the extension popup window. Coordinates UI actions and communicates
 * with background.js or voice controllers.
 */

import { MessageActions, createMessage } from '../shared/messageSchema.js';
import { TTSController } from '../voice/tts.js';
import { STTController } from '../voice/stt.js';

// DOM elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const chatHistory = document.getElementById('chat-history');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const btnExtract = document.getElementById('btn-extract');
const btnMic = document.getElementById('btn-mic');
const textInput = document.getElementById('text-input');
const btnSend = document.getElementById('btn-send');

// Controllers
const tts = new TTSController();
const stt = new STTController();

let activePageContent = null;
let conversationHistory = [];

// Set UI state
function setUIState(state, customLabel = '') {
  statusDot.className = `dot ${state.toLowerCase()}`;
  statusText.textContent = customLabel || state;
  
  if (state === 'Listening') {
    btnMic.textContent = '🛑 Stop Listening';
    btnMic.style.filter = 'hue-rotate(90deg)';
  } else {
    btnMic.textContent = '🎙️ Hold & Speak';
    btnMic.style.filter = 'none';
  }
}

// Append message to chat UI
function appendMessage(role, content) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;
  
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = content;
  
  msgDiv.appendChild(bubble);
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Event Listeners
btnExtract.addEventListener('click', async () => {
  setUIState('Thinking', 'Extracting...');
  chrome.runtime.sendMessage(createMessage(MessageActions.TRIGGER_EXTRACTION), (response) => {
    if (response && response.status === 'success') {
      activePageContent = response.data;
      setUIState('Idle', 'Ready');
      appendMessage('assistant', `Extracted "${activePageContent.title}" successfully. (${activePageContent.wordCount} words)`);
    } else {
      setUIState('Error', 'Failed');
      appendMessage('assistant', `Extraction failed: ${response ? response.message : 'Unknown error'}`);
    }
  });
});

btnSend.addEventListener('click', async () => {
  const query = textInput.value.trim();
  if (!query) return;

  textInput.value = '';
  appendMessage('user', query);
  
  if (!activePageContent) {
    appendMessage('assistant', 'Please click "Extract Page" first to ground my answers.');
    return;
  }

  setUIState('Thinking', 'Thinking...');
  
  const payload = {
    pageContent: activePageContent,
    history: conversationHistory,
    userQuery: query
  };

  chrome.runtime.sendMessage(createMessage(MessageActions.USER_QUERY, payload), (response) => {
    if (response && response.status === 'success') {
      const responseData = response.data;
      setUIState('Speaking', 'Reading...');
      appendMessage('assistant', responseData.text);
      
      // Update history
      conversationHistory.push({ role: 'user', content: query, timestamp: Date.now() });
      conversationHistory.push({ role: 'assistant', content: responseData.text, timestamp: Date.now(), isInterpretation: responseData.isInterpretation });

      // TTS output
      btnPlay.disabled = true;
      btnPause.disabled = false;
      btnStop.disabled = false;
      
      tts.speak(
        responseData.text,
        null,
        () => {
          setUIState('Idle', 'Ready');
          btnPlay.disabled = false;
          btnPause.disabled = true;
          btnStop.disabled = true;
        },
        (err) => {
          console.error('TTS error:', err);
          setUIState('Idle', 'Ready');
        }
      );
    } else {
      setUIState('Error', 'API Error');
      appendMessage('assistant', `Error getting response: ${response ? response.message : 'Unknown server error'}`);
    }
  });
});

btnMic.addEventListener('click', () => {
  if (statusText.textContent === 'Listening') {
    stt.stop();
  } else {
    // If TTS is playing, barge-in / stop TTS first
    tts.stop();
    setUIState('Listening', 'Listening');
    
    stt.start(
      (result) => {
        if (result.isFinal) {
          textInput.value = result.final;
        } else {
          textInput.value = result.interim;
        }
      },
      () => {
        setUIState('Idle', 'Ready');
        if (textInput.value.trim()) {
          btnSend.click();
        }
      },
      (err) => {
        console.error('STT error:', err);
        setUIState('Idle', 'Ready');
      }
    );
  }
});

btnPlay.addEventListener('click', () => {
  // Speaks the last assistant message if any
  const assistantMessages = conversationHistory.filter(h => h.role === 'assistant');
  if (assistantMessages.length > 0) {
    const lastMsg = assistantMessages[assistantMessages.length - 1].content;
    setUIState('Speaking', 'Reading...');
    tts.speak(lastMsg, null, () => setUIState('Idle', 'Ready'));
    btnPause.disabled = false;
    btnStop.disabled = false;
  }
});

btnPause.addEventListener('click', () => {
  tts.pause();
  setUIState('Idle', 'Paused');
});

btnStop.addEventListener('click', () => {
  tts.stop();
  setUIState('Idle', 'Ready');
  btnPause.disabled = true;
  btnStop.disabled = true;
  btnPlay.disabled = false;
});
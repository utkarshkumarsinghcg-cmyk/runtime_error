/**
 * messageSchema.js
 * 
 * Defines standard message actions and structures for chrome.runtime messaging.
 * Used for communication between Content Script, Background Worker, and Popup UI.
 */

export const MessageActions = {
  // Content Script -> Background
  CONTENT_EXTRACTED: 'CONTENT_EXTRACTED',
  CONTENT_EXTRACTION_FAILED: 'CONTENT_EXTRACTION_FAILED',

  // Popup / UI -> Background (or vice-versa)
  TRIGGER_EXTRACTION: 'TRIGGER_EXTRACTION',
  USER_QUERY: 'USER_QUERY',
  
  // Voice Controls (UI -> Voice module via Background)
  TTS_PLAY: 'TTS_PLAY',
  TTS_PAUSE: 'TTS_PAUSE',
  TTS_RESUME: 'TTS_RESUME',
  TTS_STOP: 'TTS_STOP',
  TTS_SKIP: 'TTS_SKIP',
  TTS_REPEAT: 'TTS_REPEAT',
  
  STT_START: 'STT_START',
  STT_STOP: 'STT_STOP',

  // Background -> UI / TTS status updates
  STATE_CHANGE: 'STATE_CHANGE', // e.g. "Idle", "Listening", "Thinking", "Speaking", "Error"
  STT_TRANSCRIPT: 'STT_TRANSCRIPT',
  TTS_STATE_UPDATE: 'TTS_STATE_UPDATE',
  AI_RESPONSE: 'AI_RESPONSE'
};

/**
 * Helper to build a standard extension message
 * @param {string} action - One of MessageActions
 * @param {Object} [payload] - Action-specific payload
 */
export function createMessage(action, payload = {}) {
  return {
    action,
    payload,
    timestamp: Date.now()
  };
}

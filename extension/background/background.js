/**
 * background.js
 * 
 * Extension service worker. Manages application states, routes messages
 * between UI, content scripts, and backend services.
 */

import { MessageActions } from '../shared/messageSchema.js';

const BACKEND_URL = 'http://localhost:4000';

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Browser Companion Service Worker Installed.');
});

// Listener for extension icon action clicks
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_FLOATING_PANEL' }, (res) => {
    if (chrome.runtime.lastError) {
      console.log('Error sending message:', chrome.runtime.lastError.message);
      // Fallback: inject content script if not already present
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/Readability.js', 'content/content.js']
      }).then(() => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_FLOATING_PANEL' });
        }, 100);
      }).catch(err => {
        console.error('Failed to inject content script:', err);
      });
    }
  });
});

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message);

  switch (message.action) {
    case 'TRIGGER_EXTRACTION':
      // Forward the extraction trigger to the active tab's content script
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (!tabs[0]) {
          sendResponse({ status: 'error', message: 'No active tab found' });
          return;
        }
        chrome.tabs.sendMessage(tabs[0].id, { action: 'TRIGGER_EXTRACTION' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });
      });
      return true; // async response

    case 'USER_QUERY':
      handleUserQuery(message.payload)
        .then(response => sendResponse({ status: 'success', data: response }))
        .catch(err => sendResponse({ status: 'error', message: err.message }));
      return true; // async response

    default:
      console.warn('[Background] Unknown action:', message.action);
      sendResponse({ status: 'error', message: `Unknown action: ${message.action}` });
      break;
  }
});

/**
 * Sends the query request to the backend API.
 * Routes to /api/summarize if the intent is SUMMARIZE.
 */
async function handleUserQuery(payload) {
  const isSummarize = payload.intent === 'SUMMARIZE';
  const endpoint = isSummarize ? `${BACKEND_URL}/api/summarize` : `${BACKEND_URL}/api/query`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

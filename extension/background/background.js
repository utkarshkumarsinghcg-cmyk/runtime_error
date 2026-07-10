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
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
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

    case 'FAB_CLICKED':
      if (chrome.sidePanel && chrome.sidePanel.open) {
        // Try opening with tabId first
        chrome.sidePanel.open({ tabId: sender.tab.id })
          .then(() => sendResponse({ status: 'success' }))
          .catch(err => {
            console.warn('[Background] sidePanel.open with tabId failed:', err.message);
            // Try fallback to windowId
            if (sender.tab && sender.tab.windowId) {
              chrome.sidePanel.open({ windowId: sender.tab.windowId })
                .then(() => sendResponse({ status: 'success' }))
                .catch(err2 => {
                  console.error('[Background] sidePanel.open with windowId failed:', err2.message);
                  chrome.tabs.create({ url: chrome.runtime.getURL("popup/index.html") });
                  sendResponse({ status: 'success', fallback: 'tab' });
                });
            } else {
              chrome.tabs.create({ url: chrome.runtime.getURL("popup/index.html") });
              sendResponse({ status: 'success', fallback: 'tab' });
            }
          });
      } else {
        // No SidePanel API: fallback to new tab
        chrome.tabs.create({ url: chrome.runtime.getURL("popup/index.html") });
        sendResponse({ status: 'success', fallback: 'tab' });
      }
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

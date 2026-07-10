/**
 * background.js
 * 
 * Extension service worker. Manages application states, routes messages
 * between UI, content scripts, and backend services.
 */

const BACKEND_URL = 'http://localhost:4000';

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Browser Companion Service Worker Installed.');
});

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.action) {
    case 'TRIGGER_EXTRACTION':
      // Forward the extraction trigger to the active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
      console.warn('Unknown action in background service worker:', message.action);
      sendResponse({ status: 'error', message: `Unknown action: ${message.action}` });
      break;
  }
});

/**
 * Sends the query request to the backend API.
 */
async function handleUserQuery(payload) {
  const response = await fetch(`${BACKEND_URL}/api/query`, {
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

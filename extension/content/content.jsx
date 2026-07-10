import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ShadowDomContainer from './components/ShadowDomContainer';

function initShadowDOM() {
  const rootId = 'ai-companion-root-container';
  if (document.getElementById(rootId)) return;

  // Create a container element in the host page DOM
  const container = document.createElement('div');
  container.id = rootId;
  document.body.appendChild(container);

  // Mount the React Application wrapped inside our closed ShadowDomContainer
  const root = ReactDOM.createRoot(container);
  root.render(
    <ShadowDomContainer>
      <App />
    </ShadowDomContainer>
  );

  console.log('[AI Browser Companion] React App successfully mounted within Closed Shadow DOM container.');
}

// Initialize on DOM idle
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initShadowDOM();
} else {
  window.addEventListener('DOMContentLoaded', initShadowDOM);
}

// Basic Message Passing Setup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content Script] Received message:', message);

  if (message.action === 'TRIGGER_EXTRACTION') {
    try {
      const extracted = extractCleanDOM();
      sendResponse({ status: 'success', data: extracted });
    } catch (error) {
      console.error('[Content Script] Extraction failed:', error);
      sendResponse({ status: 'error', message: error.message });
    }
  }
  return true;
});

/**
 * Placeholder function for DOM Extraction
 */
function extractCleanDOM() {
  console.log('DOM Extraction Triggered');
  return {
    url: window.location.href,
    title: document.title,
    textContent: 'DOM Extraction Triggered (Placeholder)',
    wordCount: 0,
    extractionMethod: 'shadow-dom-placeholder',
    truncated: false
  };
}

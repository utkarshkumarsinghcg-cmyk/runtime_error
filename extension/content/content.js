/**
 * content.js
 * 
 * Runs in the context of the webpage. Handles DOM extraction
 * and communication with background.js.
 */

// Listener for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  if (message.action === 'TRIGGER_EXTRACTION') {
    try {
      const extracted = performExtraction();
      sendResponse({ status: 'success', data: extracted });
    } catch (error) {
      console.error('Extraction failed:', error);
      sendResponse({ status: 'error', message: error.message });
    }
  }
  return true; // Keep message channel open for asynchronous responses
});

/**
 * Extracts content from the current DOM.
 * Utilizes a basic noise filter as a fallback shell.
 */
function performExtraction() {
  const url = window.location.href;
  const title = document.title;
  
  // Basic content fallback extraction
  const bodyText = document.body ? document.body.innerText : '';
  const cleanText = cleanDOMText(bodyText);
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  return {
    url,
    title,
    textContent: cleanText,
    wordCount,
    extractionMethod: 'raw-dom',
    truncated: false
  };
}

/**
 * Simple text cleaner shell.
 */
function cleanDOMText(text) {
  // Replace multiple newlines/spaces
  return text.replace(/\s+/g, ' ').trim();
}

console.log('AI Browser Companion Content Script Loaded.');

/**
 * content.js
 *
 * Runs in the context of the webpage. Handles DOM extraction using
 * Mozilla Readability.js, floating action button (FAB) UI injection,
 * and communication with background.js.
 *
 * Extraction priority:
 *   1. Mozilla Readability (article/blog/news pages) — highest accuracy
 *   2. Site-specific selectors (GitHub, Wikipedia)
 *   3. Density-scoring fallback (generic pages)
 */

// Listener for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content Script] Received message:', message);

  if (message.action === 'TRIGGER_EXTRACTION') {
    try {
      const extracted = performExtraction();
      sendResponse({ status: 'success', data: extracted });
    } catch (error) {
      console.error('[Content Script] Extraction failed:', error);
      sendResponse({ status: 'error', message: error.message });
    }
  } else if (message.action === 'TOGGLE_FLOATING_PANEL') {
    toggleFloatingPanel();
    sendResponse({ status: 'success' });
  }
  return true;
});

/**
 * Extracts clean textual content from the active webpage.
 *
 * Tries Mozilla Readability first, then site-specific selectors,
 * then density-scoring fallback.
 */
function performExtraction() {
  const url = window.location.href;
  const title = document.title;
  const hostname = window.location.hostname;
  let extractionMethod = 'raw-dom';
  let textContent = '';
  let excerpt = '';
  let byline = '';

  // ── 1. Mozilla Readability (best for articles, blogs, news) ────────────────
  if (typeof Readability !== 'undefined') {
    try {
      // Readability mutates the document, so always clone it first
      const documentClone = document.cloneNode(true);

      // Remove elements that Readability struggles with
      const cloneDoc = documentClone;
      cloneDoc.querySelectorAll(
        'script, style, noscript, iframe, [aria-hidden="true"], ' +
        '[class*="cookie"], [id*="cookie"], [class*="gdpr"], ' +
        '[class*="popup"], [class*="modal"], [class*="subscribe"]'
      ).forEach(el => el.remove());

      const reader = new Readability(cloneDoc, {
        charThreshold: 20,      // Minimum char count for a content block
        nbTopCandidates: 5,     // Candidates to consider for best block
        keepClasses: false,     // Strip all CSS classes from output
      });

      const article = reader.parse();

      if (article && article.textContent && article.textContent.trim().length > 100) {
        textContent = article.textContent.replace(/\s+/g, ' ').trim();
        excerpt = article.excerpt || '';
        byline = article.byline || '';
        extractionMethod = 'mozilla-readability';
        console.log('[Content Script] Extracted via Mozilla Readability:', textContent.length, 'chars');
      }
    } catch (readabilityError) {
      console.warn('[Content Script] Readability failed, falling back:', readabilityError.message);
    }
  }

  // ── 2. Site-Specific Selectors (fallback if Readability returned nothing) ──
  if (!textContent.trim()) {
    if (hostname.includes('github.com')) {
      const githubReadme = document.querySelector('article.markdown-body');
      if (githubReadme) {
        textContent = githubReadme.innerText || githubReadme.textContent || '';
        extractionMethod = 'github-selector';
      }
    } else if (hostname.includes('wikipedia.org')) {
      const wikiContent = document.querySelector('#mw-content-text');
      if (wikiContent) {
        const clone = wikiContent.cloneNode(true);
        clone.querySelectorAll('.infobox, .navbox, .metadata, .reference, .mw-editsection').forEach(el => el.remove());
        textContent = clone.innerText || clone.textContent || '';
        extractionMethod = 'wikipedia-selector';
      }
    } else if (hostname.includes('youtube.com')) {
      // YouTube: grab title + description + transcript metadata
      const vidTitle = document.querySelector('h1.ytd-video-primary-info-renderer, yt-formatted-string.ytd-watch-metadata');
      const vidDesc = document.querySelector('#description-inline-expander, ytd-text-inline-expander');
      textContent = [
        vidTitle ? vidTitle.innerText : '',
        vidDesc ? vidDesc.innerText : ''
      ].filter(Boolean).join('\n\n');
      extractionMethod = 'youtube-selector';
    } else if (hostname.includes('reddit.com')) {
      const post = document.querySelector('[data-test-id="post-content"], .Post, shreddit-post');
      if (post) {
        textContent = post.innerText || post.textContent || '';
        extractionMethod = 'reddit-selector';
      }
    }
  }

  // ── 3. Density-Scoring Fallback (generic pages) ────────────────────────────
  if (!textContent.trim()) {
    const noiseSelectors = [
      'nav', 'footer', 'aside', 'header[role="banner"]',
      '[class*="cookie"]', '[id*="cookie"]',
      '[class*="advert"]', '[class*="ads-"]', '[id*="ad-"]',
      '[class*="sidebar"]', '[aria-hidden="true"]',
      'script', 'style', 'noscript', 'iframe'
    ];

    const bodyClone = document.body.cloneNode(true);
    noiseSelectors.forEach(selector => {
      bodyClone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Score containers by paragraph content density
    const containers = bodyClone.querySelectorAll('div, article, section, main');
    let bestContainer = null;
    let highestScore = 0;

    containers.forEach(container => {
      const paragraphs = container.querySelectorAll('p');
      const textLen = (container.innerText || '').trim().length;
      if (textLen < 200) return;

      let score = paragraphs.length * 50 + Math.floor(textLen / 10);

      // Penalise high link density (navigation areas)
      const links = container.querySelectorAll('a');
      if (links.length > 0) {
        const linkTextLen = Array.from(links).reduce((acc, a) => acc + (a.innerText || '').trim().length, 0);
        const linkDensity = linkTextLen / textLen;
        if (linkDensity > 0.4) {
          score = Math.floor(score * (1 - linkDensity));
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestContainer = container;
      }
    });

    if (bestContainer && highestScore > 100) {
      textContent = bestContainer.innerText || bestContainer.textContent || '';
      extractionMethod = 'density-scoring-fallback';
    } else {
      textContent = bodyClone.innerText || bodyClone.textContent || '';
      extractionMethod = 'raw-dom';
    }
  }

  // ── Cleanup & Package ───────────────────────────────────────────────────────
  const cleanText = textContent.replace(/\s+/g, ' ').trim();
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  console.log(`[Content Script] Extraction complete via [${extractionMethod}]: ${wordCount} words`);

  return {
    url,
    title,
    textContent: cleanText,
    wordCount,
    extractionMethod,
    excerpt,
    byline,
    truncated: false
  };
}

let shadowHost = null;
let shadowRoot = null;
let panelContainer = null;
let fabElement = null;

let currentTop = 100;
let currentLeft = window.innerWidth - 810;
let dragStartTop = 100;
let dragStartLeft = window.innerWidth - 810;

/**
 * Initializes the isolated Shadow DOM hosting the FAB and Floating panel.
 */
function initShadowDOM() {
  const url = window.location.href;
  if (url.startsWith('chrome-extension://') || url.includes('localhost:') || url.includes('127.0.0.1:')) {
    return;
  }

  if (document.getElementById('ai-browser-companion-root')) return;

  shadowHost = document.createElement('div');
  shadowHost.id = 'ai-browser-companion-root';
  Object.assign(shadowHost.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    zIndex: '2147483647',
    pointerEvents: 'none'
  });
  document.body.appendChild(shadowHost);

  shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  // Stylings encapsulated inside Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    #ai-companion-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(5, 7, 22, 0.45);
      z-index: 2147483647;
      pointer-events: auto;
      transition: all 0.2s ease;
      user-select: none;
    }
    #ai-companion-fab:hover {
      transform: scale(1.1) translateY(-2px);
      box-shadow: 0 12px 40px rgba(5, 7, 22, 0.6);
    }
    #ai-companion-fab:active {
      transform: scale(0.95);
    }
    #ai-companion-fab svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    #ai-companion-floating-panel {
      position: fixed;
      z-index: 2147483647;
      width: 780px;
      height: 520px;
      top: 100px;
      right: 30px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
      border: 1px solid #d4d4d4;
      overflow: hidden;
      display: none;
      flex-direction: column;
      pointer-events: auto;
      transition: opacity 0.25s ease, transform 0.25s ease;
      opacity: 0;
      transform: translateY(15px);
    }
    #ai-companion-floating-panel.visible {
      display: flex;
      opacity: 1;
      transform: translateY(0);
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
    }
  `;
  shadowRoot.appendChild(style);

  // Injected Panel Frame Container
  panelContainer = document.createElement('div');
  panelContainer.id = 'ai-companion-floating-panel';
  
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('popup/index.html');
  panelContainer.appendChild(iframe);
  shadowRoot.appendChild(panelContainer);

  // Injected FAB trigger button
  fabElement = document.createElement('div');
  fabElement.id = 'ai-companion-fab';
  fabElement.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050716" />
      <stop offset="60%" stop-color="#0d0824" />
      <stop offset="100%" stop-color="#1b0833" />
    </linearGradient>

    <!-- Border Gradient -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2fe" />
      <stop offset="30%" stop-color="#3b82f6" />
      <stop offset="70%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#d946ef" />
    </linearGradient>

    <!-- Metallic Silver Gradient for R -->
    <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="30%" stop-color="#e2e8f0" />
      <stop offset="70%" stop-color="#94a3b8" />
      <stop offset="100%" stop-color="#475569" />
    </linearGradient>

    <!-- Brain Lobe Gradient -->
    <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a855f7" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0.9" />
    </linearGradient>

    <!-- Gloss Overlay -->
    <linearGradient id="glossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Outer Ring with Gradient -->
  <circle cx="64" cy="64" r="60" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="4.5" />

  <!-- Brain Lobe Shape (Right Side) -->
  <path d="M72,32 C82,32 94,40 98,50 C102,58 102,68 96,76 C92,82 82,86 74,86 C74,86 70,82 72,74 C74,66 76,58 72,50 C68,42 66,34 72,32 Z" fill="url(#brainGrad)" />

  <!-- Brain Circuitry Lines (Cyan) -->
  <path d="M76,42 L84,48 L84,56" stroke="#00f2fe" stroke-width="2" fill="none" stroke-linecap="round" />
  <path d="M80,36 L90,44 L90,52" stroke="#00f2fe" stroke-width="2" fill="none" stroke-linecap="round" />
  <path d="M84,60 L94,62 L94,70" stroke="#00f2fe" stroke-width="2" fill="none" stroke-linecap="round" />
  <path d="M76,68 L86,72 L86,78" stroke="#00f2fe" stroke-width="2" fill="none" stroke-linecap="round" />

  <!-- Glowing Circuit Dots -->
  <circle cx="84" cy="56" r="3" fill="#00f2fe" />
  <circle cx="90" cy="52" r="3" fill="#00f2fe" />
  <circle cx="94" cy="70" r="3" fill="#00f2fe" />
  <circle cx="86" cy="78" r="3" fill="#00f2fe" />

  <!-- Stylized Futuristic Letter R -->
  <path d="M30,48 L56,48 C72,48 76,58 64,68 L80,92 L62,92 L48,72 L44,72 L44,92 L30,92 Z" fill="url(#silverGrad)" />
  <!-- Inner Loop cutout of R -->
  <path d="M44,58 L54,58 C58,58 60,62 56,66 L44,66 Z" fill="#0c0824" />

  <!-- Terminal Prompt >_ -->
  <text x="32" y="78" fill="#00f2fe" font-family="'Courier New', monospace" font-size="14" font-weight="bold">&gt;_</text>

  <!-- Sparkle/Star in Top Right -->
  <path d="M102,24 Q106,28 110,24 Q106,20 102,24 Z" fill="#f472b6" />
  <circle cx="106" cy="24" r="1.5" fill="#ffffff" />

  <!-- Gloss Highlight Overlay -->
  <path d="M4,64 A60,60 0 0,1 124,64 A60,30 0 0,0 4,64 Z" fill="url(#glossGrad)" />
</svg>
  `;
  fabElement.addEventListener('click', () => {
    fabElement.style.transform = 'scale(0.95)';
    setTimeout(() => { fabElement.style.transform = 'scale(1.1)'; }, 100);
    toggleFloatingPanel();
  });
  shadowRoot.appendChild(fabElement);

  // Default repositioning layout bounds
  currentLeft = Math.max(10, window.innerWidth - 810);
  dragStartLeft = currentLeft;
}

/**
 * Toggles the visibility of the floating panel inside the page.
 */
function toggleFloatingPanel() {
  if (!panelContainer) {
    initShadowDOM();
  }
  if (!panelContainer) return;

  if (panelContainer.classList.contains('visible')) {
    panelContainer.classList.remove('visible');
    setTimeout(() => {
      if (!panelContainer.classList.contains('visible')) {
        panelContainer.style.display = 'none';
      }
    }, 250);
  } else {
    panelContainer.style.display = 'flex';
    // Force reflow
    panelContainer.offsetHeight;
    panelContainer.classList.add('visible');
  }
}

let isDragging = false;
let startScreenX = 0;
let startScreenY = 0;

function onHostPointerMove(e) {
  if (!isDragging || !panelContainer) return;
  const dx = e.screenX - startScreenX;
  const dy = e.screenY - startScreenY;

  const newTop = dragStartTop + dy;
  const newLeft = dragStartLeft + dx;

  // Constrain within viewport boundaries
  const clampedTop = Math.max(0, Math.min(window.innerHeight - 50, newTop));
  const clampedLeft = Math.max(0, Math.min(window.innerWidth - 50, newLeft));

  panelContainer.style.top = `${clampedTop}px`;
  panelContainer.style.left = `${clampedLeft}px`;
  panelContainer.style.right = 'auto';
  panelContainer.style.bottom = 'auto';
}

function onHostPointerUp(e) {
  isDragging = false;
  window.removeEventListener('pointermove', onHostPointerMove);
  window.removeEventListener('pointerup', onHostPointerUp);
  
  const iframe = panelContainer ? panelContainer.querySelector('iframe') : null;
  if (iframe) {
    iframe.style.pointerEvents = 'auto';
  }
}

// Drag & Close communications listener from iframe
window.addEventListener('message', (event) => {
  if (!event.origin.startsWith('chrome-extension://')) return;
  if (!event.data) return;

  if (event.data.type === 'COMPANION_DRAG_START') {
    const container = panelContainer;
    if (!container) return;

    isDragging = true;
    startScreenX = event.data.screenX;
    startScreenY = event.data.screenY;

    const rect = container.getBoundingClientRect();
    dragStartTop = rect.top;
    dragStartLeft = rect.left;

    const iframe = container.querySelector('iframe');
    if (iframe) {
      iframe.style.pointerEvents = 'none';
    }

    window.addEventListener('pointermove', onHostPointerMove);
    window.addEventListener('pointerup', onHostPointerUp);
  } else if (event.data.type === 'COMPANION_CLOSE') {
    if (panelContainer && panelContainer.classList.contains('visible')) {
      toggleFloatingPanel();
    }
  }
});

// Initialize on page load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initShadowDOM();
} else {
  window.addEventListener('DOMContentLoaded', initShadowDOM);
}

console.log('[AI Browser Companion] Content script with floating panel initialized.');

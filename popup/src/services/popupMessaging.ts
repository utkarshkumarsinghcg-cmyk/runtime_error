/**
 * popupMessaging.ts
 *
 * Directs communication between the React Popup UI and the Background Service Worker.
 * When running outside the Chrome extension sandbox (e.g. web dev preview), falls back
 * to calling the backend server DIRECTLY via HTTP so real LLM responses still work.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { MessageActions, createMessage } from './messageSchema.js';

/** Base URL of the Express AI backend */
const BACKEND_URL = 'http://localhost:4000';

/**
 * Extracts a plain string from the page content object or passes a string through.
 * The backend /api/query requires pageContent to be a string, not an object.
 */
function resolvePageContent(pageContent: any): string {
  if (!pageContent) return '';
  if (typeof pageContent === 'string') return pageContent;
  // extractedData is {title, textContent, wordCount, url, ...} — use textContent
  return [pageContent.title ? `Title: ${pageContent.title}` : '', pageContent.textContent || '']
    .filter(Boolean)
    .join('\n\n');
}

export const popupMessaging = {
  /**
   * Sends a standardized action message to the background worker.
   * Falls back to direct HTTP calls to localhost:4000 when chrome.runtime is unavailable.
   */
  sendMessage(action: string, payload: any = {}, timeoutMs = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      // ── Web preview fallback: call backend directly ──────────────────────────
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        console.info(
          `[popupMessaging] chrome.runtime unavailable — calling backend directly for: ${action}`
        );

        if (action === MessageActions.TRIGGER_EXTRACTION) {
          // Return synthetic page data so the UI unblocks immediately
          setTimeout(() => {
            resolve({
              url: window.location.href,
              title: document.title || 'Web Preview Page',
              textContent:
                'This is a web development preview. Attach the extension to a real browser tab for live page extraction. You can still test AI queries using this placeholder content.',
              wordCount: 30,
              extractionMethod: 'mock-preview',
              truncated: false,
            });
          }, 400);
          return;
        }

        if (action === MessageActions.USER_QUERY) {
          // Call backend /api/query directly — bypasses chrome messaging layer
          const pageContentStr = resolvePageContent(payload.pageContent);

          fetch(`${BACKEND_URL}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(timeoutMs),
            body: JSON.stringify({
              pageContent: pageContentStr,
              question: payload.userQuery, // server/ format
              userQuery: payload.userQuery, // backend/ format (TypeScript backend)
              provider: payload.provider || 'ollama',
              history: payload.history || [],
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                // Handle both error formats: { message } and { error: { message } }
                const errMsg =
                  errBody?.error?.message ||
                  errBody?.message ||
                  `Backend returned ${res.status} ${res.statusText}`;
                throw new Error(errMsg);
              }
              return res.json();
            })
            .then((data) => resolve(data))
            .catch((err) => {
              if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                reject(new Error('Request timed out. Is the server running? (npm run dev:server)'));
              } else if (
                err.message?.includes('Failed to fetch') ||
                err.message?.includes('ECONNREFUSED')
              ) {
                reject(
                  new Error('Cannot reach backend at localhost:4000. Run: npm run dev:server')
                );
              } else {
                reject(err);
              }
            });
          return;
        }

        // Unknown action — resolve with status
        setTimeout(() => resolve({ status: 'mocked', action }), 200);
        return;
      }

      // ── Extension sandbox path: use chrome.runtime.sendMessage ──────────────
      const message = createMessage(action, payload);
      let isSettled = false;

      const timeoutId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          reject(new Error(`Timeout waiting for background response to action: ${action}`));
        }
      }, timeoutMs);

      try {
        chrome.runtime.sendMessage(message, (response: any) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message || '';
            if (errMsg.includes('Receiving end does not exist')) {
              reject(new Error('Cannot extract content from this page. Ensure the page has fully loaded and is not a protected system page (e.g., chrome://).'));
            } else {
              reject(new Error(errMsg));
            }
            return;
          }

          if (!response) {
            reject(new Error(`Empty response for action: ${action}`));
            return;
          }

          if (response.status === 'success') {
            resolve(response.data);
          } else {
            reject(new Error(response.error || 'Action processing failure'));
          }
        });
      } catch (err) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      }
    });
  },

  triggerExtraction(): Promise<any> {
    return this.sendMessage(MessageActions.TRIGGER_EXTRACTION);
  },

  submitQuery(
    pageContent: any,
    history: any[],
    userQuery: string,
    provider?: string
  ): Promise<any> {
    return this.sendMessage(MessageActions.USER_QUERY, {
      pageContent,
      history,
      userQuery,
      provider,
    });
  },
};

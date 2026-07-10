/**
 * ollama.js
 *
 * Swappable LLM adapter for Ollama local provider.
 * Connects to a local Ollama instance running on localhost:11434.
 *
 * Tuning applied:
 *  - temperature 0.3  → more factual, less hallucination
 *  - top_p 0.85       → focused sampling, avoids low-prob tokens
 *  - top_k 40         → tightens token candidates
 *  - repeat_penalty 1.15 → stops repetitive loops
 *  - num_ctx 8192     → 8k context window (fits full articles)
 *  - num_predict 1024 → max answer length
 */

export class OllamaAdapter {
  constructor() {
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.modelName = process.env.OLLAMA_MODEL || 'llama3';
  }

  /**
   * Completes a chat request grounded in the page content.
   * @param {object} params
   * @param {string} params.systemPrompt  - Task-specific instruction
   * @param {string} params.pageContent   - Extracted page text (or empty for freeform)
   * @param {Array}  params.history       - Prior messages [{role, content}]
   * @param {string} params.userQuery     - The user's question
   */
  async complete({ systemPrompt, pageContent, history, userQuery }) {
    const endpoint = `${this.host}/api/chat`;

    // ── Build the messages array ──────────────────────────────────────────────
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Inject page context as a clearly delimited system message
    if (pageContent && pageContent.trim().length > 0) {
      messages.push({
        role: 'system',
        content:
          `Below is the extracted content of the active webpage. ` +
          `Use it as your primary and authoritative source for answering the user's query. ` +
          `Do NOT rely on knowledge outside this content unless asked a general question.\n\n` +
          `<page_context>\n${pageContent}\n</page_context>`
      });
    }

    // Inject chat history — cap at last 10 turns to stay within context window
    if (history && history.length > 0) {
      const recentHistory = history.slice(-10);
      recentHistory.forEach(turn => {
        // Skip system messages and any ultra-long assistant blobs from storage
        if (turn.role === 'system') return;
        const truncated = turn.content.length > 2000
          ? turn.content.substring(0, 2000) + '...[truncated]'
          : turn.content;
        messages.push({ role: turn.role, content: truncated });
      });
    }

    messages.push({ role: 'user', content: userQuery });

    // ── Inference options (key quality levers) ────────────────────────────────
    const options = {
      temperature:    parseFloat(process.env.OLLAMA_TEMPERATURE    || '0.3'),
      top_p:          parseFloat(process.env.OLLAMA_TOP_P          || '0.85'),
      top_k:          parseInt(  process.env.OLLAMA_TOP_K          || '40',  10),
      repeat_penalty: parseFloat(process.env.OLLAMA_REPEAT_PENALTY || '1.15'),
      num_ctx:        parseInt(  process.env.OLLAMA_NUM_CTX        || '8192',10),
      num_predict:    parseInt(  process.env.OLLAMA_NUM_PREDICT    || '1024',10),
    };

    // ── Retry loop with exponential back-off ──────────────────────────────────
    const maxAttempts = 3;
    let delay = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.modelName,
            messages,
            stream: false,
            options
          })
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Ollama HTTP ${response.status}: ${errBody.slice(0, 200)}`);
        }

        const data = await response.json();
        const text = (data.message?.content || '').trim();

        if (!text) {
          throw new Error('Ollama returned an empty response body.');
        }

        console.log(`[OllamaAdapter] Response (${text.length} chars) via ${this.modelName}`);

        return { text, isInterpretation: true };

      } catch (error) {
        console.warn(`[OllamaAdapter] Attempt ${attempt + 1}/${maxAttempts} failed: ${error.message}`);

        if (attempt === maxAttempts - 1) {
          console.error('[OllamaAdapter] All attempts exhausted.');
          return {
            text: `⚠️ Could not connect to Ollama at ${this.host}. Please make sure Ollama is running and the model "${this.modelName}" is loaded.\n\nRun: \`ollama run ${this.modelName}\``,
            isInterpretation: false
          };
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // exponential back-off: 1s → 2s → 4s
      }
    }
  }
}

/**
 * @typedef {Object} ExtractedContent
 * @property {string} url - The URL of the page.
 * @property {string} title - The title of the page.
 * @property {string} textContent - Cleaned/extracted text content of the page.
 * @property {string} [byline] - Author/byline information.
 * @property {string} [siteName] - Name of the website (e.g. Wikipedia).
 * @property {number} wordCount - Word count of the extracted text.
 * @property {"readability" | "cheerio-fallback" | "raw-dom"} extractionMethod - Pipeline step that succeeded.
 * @property {boolean} truncated - Whether the content was truncated due to token/size limits.
 */

/**
 * @typedef {Object} ChatTurn
 * @property {"user" | "assistant"} role - The speaker role.
 * @property {string} content - The message content.
 * @property {number} timestamp - Epoch timestamp (ms).
 * @property {boolean} [isInterpretation] - Whether the response is an AI opinion/interpretation.
 */

/**
 * @typedef {Object} QueryRequest
 * @property {ExtractedContent} pageContent - The extracted content of the page.
 * @property {ChatTurn[]} history - Conversation history.
 * @property {string} userQuery - The current query from the user.
 * @property {string} [intent] - Classification hint (e.g. SUMMARIZE, EXPLAIN_SIMPLE, FREEFORM_QA).
 */

/**
 * @typedef {Object} QueryResponse
 * @property {string} text - The AI response text.
 * @property {boolean} isInterpretation - Whether the response is AI interpretation/opinion.
 * @property {boolean} groundedInPage - Whether the answer is grounded in page content.
 * @property {Object} [error] - Error details if extraction or generation failed.
 * @property {string} error.code - Error code (e.g. EXTRACTION_FAILED, CONTENT_TOO_LARGE, LLM_ERROR, NO_CONTENT).
 * @property {string} error.message - Human readable error message.
 */

// Export dummy schemas or structure templates to allow importing in ESM
export const Templates = {
  ExtractedContent: {
    url: '',
    title: '',
    textContent: '',
    byline: '',
    siteName: '',
    wordCount: 0,
    extractionMethod: 'raw-dom',
    truncated: false
  },
  ChatTurn: {
    role: 'user',
    content: '',
    timestamp: 0,
    isInterpretation: false
  },
  QueryRequest: {
    pageContent: null,
    history: [],
    userQuery: '',
    intent: ''
  },
  QueryResponse: {
    text: '',
    isInterpretation: false,
    groundedInPage: true,
    error: null
  }
};

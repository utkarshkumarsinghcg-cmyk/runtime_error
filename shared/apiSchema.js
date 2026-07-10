/**
 * apiSchema.js
 * 
 * Defines request and response validation shapes / structure templates
 * for the stateless Node.js / Express Backend API.
 */

export const ApiEndpoints = {
  QUERY: '/api/query',
  SUMMARIZE: '/api/summarize',
  HEALTH: '/api/health'
};

/**
 * Validates the query request body shape.
 * @param {Object} body
 * @returns {boolean}
 */
export function isValidQueryRequest(body) {
  if (!body) return false;
  if (!body.pageContent || typeof body.pageContent.textContent !== 'string') return false;
  if (!Array.isArray(body.history)) return false;
  if (typeof body.userQuery !== 'string') return false;
  return true;
}

/**
 * Validates the summarize request body shape.
 * @param {Object} body
 * @returns {boolean}
 */
export function isValidSummarizeRequest(body) {
  if (!body) return false;
  if (!body.pageContent || typeof body.pageContent.textContent !== 'string') return false;
  return true;
}

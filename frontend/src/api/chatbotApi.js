const API_BASE = '/api/chatbot';

/**
 * Send user message to chatbot and get search parameters
 *
 * @param {string} message - User's natural language message describing what they want
 * @returns {Promise<{message: string, searchParams: {query, location, minPrice, maxPrice}, confidence: number}>}
 */
export async function processMessage(message) {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Message is required');
  }

  const response = await fetch(`${API_BASE}/process-message`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: message.trim() }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'Failed to process message');
    error.status = response.status;
    throw error;
  }

  return {
    message: data.message || 'Got it! Searching...',
    searchParams: data.searchParams || {},
    confidence: data.confidence || 0,
  };
}

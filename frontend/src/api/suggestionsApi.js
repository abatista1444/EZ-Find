const API_BASE = '/api/suggestions';

/**
 * Fetch personalized suggestions based on user's saved items and recent search results.
 * No new API searches are performed—uses content-based filtering.
 *
 * @param {Array} recentSearchResults - Recent listing objects from user's searches
 * @param {number} limit - Max suggestions to return (default 10)
 * @returns {Promise<{suggestions: Array, metadata: Object}>}
 */
export async function fetchSuggestions(recentSearchResults = [], limit = 10) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recentResults: Array.isArray(recentSearchResults) ? recentSearchResults : [],
      limit: Math.min(50, Math.max(1, limit))
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to load suggestions');
  }

  return {
    suggestions: data.suggestions || [],
    metadata: data.metadata || {}
  };
}

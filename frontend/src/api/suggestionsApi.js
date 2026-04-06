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
  const params = new URLSearchParams();
  params.append('limit', limit);

  // Pass recent search results to backend for content-based filtering
  if (Array.isArray(recentSearchResults) && recentSearchResults.length > 0) {
    params.append('recentResults', JSON.stringify(recentSearchResults));
  }

  const response = await fetch(`${API_BASE}?${params}`, {
    method: 'GET',
    credentials: 'include',
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

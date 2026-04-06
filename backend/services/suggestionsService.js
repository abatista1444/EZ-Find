/**
 * Service for generating personalized suggestions based on user's shopping history.
 * Uses content-based filtering on saved items WITHOUT making new search requests
 * to avoid rate limiting issues.
 */

/**
 * Extract dominant keywords and characteristics from saved items.
 */
function extractUserProfile(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      keywords: [],
      avgPrice: null,
      priceRange: { min: null, max: null },
      preferredLocations: [],
      preferredSources: []
    };
  }

  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'is', 'are', 'was', 'be', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'can', 'new', 'used', 'item', 'listing', 'post', 'ad', 'sale'
  ]);

  // Extract keywords from titles and descriptions
  const words = [];
  let totalPrice = 0;
  let priceCount = 0;
  const prices = [];

  for (const item of items) {
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    const tokens = text
      .split(/\s+/)
      .filter(w => w.length > 3 && !commonWords.has(w))
      .map(w => w.replace(/[^a-z0-9]/g, ''));

    words.push(...tokens);

    if (item.price && typeof item.price === 'number') {
      totalPrice += item.price;
      priceCount++;
      prices.push(item.price);
    }
  }

  // Get top keywords
  const frequency = {};
  for (const word of words) {
    if (word) {
      frequency[word] = (frequency[word] || 0) + 1;
    }
  }

  const topKeywords = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Calculate price stats
  prices.sort((a, b) => a - b);
  const avgPrice = priceCount > 0 ? totalPrice / priceCount : null;
  const minPrice = prices.length > 0 ? prices[0] : null;
  const maxPrice = prices.length > 0 ? prices[prices.length - 1] : null;

  // Get location preferences
  const locationFreq = {};
  const sourceFreq = {};

  for (const item of items) {
    if (item.location) {
      locationFreq[item.location] = (locationFreq[item.location] || 0) + 1;
    }
    if (item.source) {
      sourceFreq[item.source] = (sourceFreq[item.source] || 0) + 1;
    }
  }

  const preferredLocations = Object.entries(locationFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([loc]) => loc);

  const preferredSources = Object.entries(sourceFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([source]) => source);

  return {
    keywords: topKeywords,
    avgPrice,
    priceRange: { min: minPrice, max: maxPrice },
    preferredLocations,
    preferredSources
  };
}

/**
 * Calculate similarity score between a test item and the user's profile.
 * Higher score = more similar to user's interests.
 */
function calculateSimilarityScore(item, userProfile) {
  let score = 0;

  // Keyword matching (0-40 points)
  if (userProfile.keywords.length > 0) {
    const itemText = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    const matches = userProfile.keywords.filter(kw => itemText.includes(kw)).length;
    score += (matches / userProfile.keywords.length) * 40;
  }

  // Price similarity (0-30 points)
  if (userProfile.avgPrice !== null && item.price !== null) {
    const priceDiff = Math.abs(item.price - userProfile.avgPrice);
    const percentDiff = priceDiff / Math.max(userProfile.avgPrice, 1);
    // Full points if within 50%, decreasing
    score += Math.max(0, 30 * (1 - percentDiff / 0.5));
  }

  // Location match (0-15 points)
  if (userProfile.preferredLocations.length > 0 && item.location) {
    const isMatch = userProfile.preferredLocations.some(loc =>
      item.location.toLowerCase().includes(loc.toLowerCase())
    );
    if (isMatch) {
      score += 15;
    }
  }

  // Source preference (0-15 points)
  if (userProfile.preferredSources.length > 0 && item.source) {
    const sourceIndex = userProfile.preferredSources.indexOf(item.source);
    if (sourceIndex !== -1) {
      // Higher score for more preferred sources
      score += 15 * (1 - sourceIndex / userProfile.preferredSources.length);
    }
  }

  return score;
}

/**
 * Find items in a collection similar to the user's saved items.
 * Without making new search queries—content-based filtering only.
 */
function findSimilarItems(candidateItems, savedItems, userProfile, limit = 10) {
  if (candidateItems.length === 0 || savedItems.length === 0) {
    return [];
  }

  // Create set of already-saved IDs for filtering
  const savedIds = new Set(savedItems.map(item => item.externalItemId));

  // Score each candidate item
  const scored = candidateItems
    .filter(item => !savedIds.has(item.id))
    .map(item => ({
      ...item,
      _similarity: calculateSimilarityScore(item, userProfile)
    }))
    .sort((a, b) => b._similarity - a._similarity)
    .slice(0, limit);

  // Remove scoring metadata before returning
  return scored.map(item => {
    const { _similarity, ...rest } = item;
    return rest;
  });
}

/**
 * Deduplicate items by URL.
 */
function deduplicateByUrl(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (item.url && !seen.has(item.url)) {
      seen.add(item.url);
      deduped.push(item);
    }
  }
  return deduped;
}

class SuggestionsService {
  /**
   * @param {SavedItemsService} savedItemsService - service for accessing saved items
   */
  constructor(savedItemsService) {
    this.savedItemsService = savedItemsService;
  }

  /**
   * Generate personalized suggestions based on user's saved items.
   * Uses content-based filtering WITHOUT making new marketplace searches.
   *
   * @param {number} userId - user ID
   * @param {Array} recentSearchResults - recent listings from user's searches (optional)
   * @param {Object} options
   * @param {number} options.limit - max number of suggestions to return (default 10)
   * @returns {Promise<{suggestions: Array, metadata: Object}>}
   */
  async generateSuggestionsForUser(userId, recentSearchResults = [], options = {}) {
    const limit = options.limit || 10;

    try {
      // Get user's saved items
      const savedItems = await this.savedItemsService.listSavedItemsForUser(userId);

      // Handle case where user has no saved items
      if (savedItems.length === 0) {
        return {
          suggestions: [],
          metadata: {
            reason: 'No saved items available. Save items from search results to get personalized suggestions.',
            queriesUsed: [],
            method: 'content-based'
          }
        };
      }

      // Extract user profile from saved items
      const userProfile = extractUserProfile(savedItems);

      // If no recent search results provided, we can't generate suggestions
      if (!Array.isArray(recentSearchResults) || recentSearchResults.length === 0) {
        return {
          suggestions: [],
          metadata: {
            reason: 'No recent search results available. Perform a search to see suggestions based on your interests.',
            userProfile,
            queriesUsed: [],
            method: 'content-based'
          }
        };
      }

      // Deduplicate by URL
      const candidates = deduplicateByUrl(recentSearchResults);

      // Find similar items from recent search results
      const suggestions = findSimilarItems(candidates, savedItems, userProfile, limit);

      return {
        suggestions,
        metadata: {
          userProfile,
          queriesUsed: [],
          method: 'content-based',
          candidatesAnalyzed: candidates.length,
          savedItemsCount: savedItems.length
        }
      };
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return {
        suggestions: [],
        metadata: {
          reason: `Error generating suggestions: ${error.message}`,
          queriesUsed: [],
          method: 'content-based'
        }
      };
    }
  }
}

module.exports = {
  SuggestionsService,
  extractUserProfile,
  calculateSimilarityScore,
  findSimilarItems,
  deduplicateByUrl
};

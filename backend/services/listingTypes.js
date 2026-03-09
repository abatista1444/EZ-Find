/**
 * @typedef {Object} SearchParams
 * @property {string} query - The search keywords entered by the user.
 * @property {string} [location] - Optional geographic filter (city, zip, etc.).
 * @property {number} [minPrice] - Minimum price in USD.
 * @property {number} [maxPrice] - Maximum price in USD.
 * @property {Object} [extras] - Provider-specific extras (category, condition, etc.).
 */

/**
 * @typedef {Object} Listing
 * @property {string} id - Unique identifier from the source marketplace.
 * @property {string} title - Title of the listing.
 * @property {number} price - Numeric price in USD (may be 0 if free/unknown).
 * @property {string} url - Direct URL to the listing on the marketplace.
 * @property {string} source - Marketplace source identifier (for example 'craigslist').
 * @property {string} [image] - URL of a thumbnail or main image.
 * @property {string} [location] - Text description of the item's location.
 * @property {Date} [postedAt] - When the listing was posted (if available).
 */

/**
 * @typedef {Object} MarketplaceError
 * @property {string} source - The marketplace name where the error occurred.
 * @property {string} message - Human-readable error message.
 * @property {Error} [original] - Original error object, if available.
 */

/**
 * @interface MarketplaceConnector
 * Implementations must provide a `search` method that accepts SearchParams
 * and returns a Promise resolving to an array of normalized Listing objects.
 *
 * @method search
 * @param {SearchParams} params
 * @returns {Promise<Listing[]>}
 */

/**
 * @typedef {Object} CraigslistSource
 * @property {function(): string} getName - Human-readable source strategy name.
 * @property {function(SearchParams): Promise<Array<Object>>} fetchRaw - Fetch raw
 * Craigslist records before normalization.
 */

// This module doesn't export anything at runtime; it exists solely to host
// shared typedefs for use in JSDoc across the codebase.

module.exports = {};

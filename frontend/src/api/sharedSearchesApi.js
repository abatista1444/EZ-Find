/**
 * API utilities for shared searches
 */

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

/**
 * Create a new shareable search token
 * @param {object} searchParams - { query, location?, minPrice?, maxPrice? }
 * @param {string} expiresAt - Optional ISO 8601 date string for expiration
 * @returns {Promise<object>} { token, shareUrl, createdAt, expiresAt }
 */
export async function createSharedSearch(searchParams, expiresAt = null) {
  const response = await fetch(`${API_BASE}/shared-searches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      query: searchParams.query,
      location: searchParams.location || undefined,
      minPrice: searchParams.minPrice || undefined,
      maxPrice: searchParams.maxPrice || undefined,
      expiresAt: expiresAt || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create shared search');
  }

  return response.json();
}

/**
 * Retrieve shared search parameters by token
 * @param {string} token - Share token
 * @returns {Promise<object>} Search parameters and metadata
 */
export async function getSharedSearch(token) {
  const response = await fetch(`${API_BASE}/shared-searches/${token}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 410) {
      const error = await response.json();
      throw new Error(`Shared search has expired (${error.expiresAt})`);
    } else if (response.status === 404) {
      throw new Error('Shared search not found');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to retrieve shared search');
  }

  return response.json();
}

/**
 * Get the list of shared searches created by the current user
 * @returns {Promise<array>} Array of shared search tokens and metadata
 */
export async function getMySharedSearches() {
  const response = await fetch(`${API_BASE}/shared-searches/user/my-shares`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to retrieve your shared searches');
  }

  const data = await response.json();
  return data.shares || [];
}

/**
 * Construct the full share URL
 * @param {string} token - Share token
 * @returns {string} Full shareable URL
 */
export function constructShareUrl(token) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/search/${token}`;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  } catch (err) {
    throw new Error('Failed to copy to clipboard');
  }
}

const crypto = require('crypto');
const db = require('../db');

class SharedSearchService {
  /**
   * Generate a cryptographically-secure random token
   * @returns {string} 64-character hex string
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new shared search token
   * @param {number} userId - ID of user creating the share
   * @param {object} searchParams - Search parameters { query, location?, minPrice?, maxPrice? }
   * @param {string|null} expiresAt - Optional expiration date in ISO format
   * @returns {object} { token, createdAt, expiresAt }
   */
  async createSharedSearch(userId, searchParams, expiresAt = null) {
    // Validate required parameters
    if (!userId || !searchParams || !searchParams.query) {
      throw new Error('UserId and search query are required');
    }

    const token = this.generateToken();
    const { query, location, minPrice, maxPrice } = searchParams;

    const sql = `
      INSERT INTO SharedSearchTokens
      (Token, CreatedBy, SearchQuery, Location, MinPrice, MaxPrice, ExpiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      db.query(sql, [token, userId, query, location || null, minPrice || null, maxPrice || null, expiresAt || null], (err) => {
        if (err) {
          console.error('Error creating shared search:', err);
          reject(err);
        } else {
          resolve({
            token,
            createdAt: new Date().toISOString(),
            expiresAt,
          });
        }
      });
    });
  }

  /**
   * Retrieve a shared search if valid and not expired
   * @param {string} token - Share token
   * @returns {object|null} Search parameters if valid, null if expired or not found
   */
  async getSharedSearch(token) {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const sql = `
      SELECT
        ts.Token, ts.SearchQuery, ts.Location, ts.MinPrice, ts.MaxPrice,
        ts.CreatedAt, ts.ExpiresAt, ts.AccessCount,
        CONCAT(u.FirstName, ' ', u.LastName) as CreatedBy
      FROM SharedSearchTokens ts
      LEFT JOIN Users u ON ts.CreatedBy = u.UserId
      WHERE ts.Token = ?
    `;

    return new Promise((resolve, reject) => {
      db.query(sql, [token], async (err, results) => {
        if (err) {
          console.error('Error retrieving shared search:', err);
          reject(err);
          return;
        }

        if (!results || results.length === 0) {
          resolve(null);
          return;
        }

        const share = results[0];

        // Check if token has expired
        if (share.ExpiresAt) {
          const expiresAt = new Date(share.ExpiresAt);
          if (expiresAt < new Date()) {
            resolve({ isExpired: true, expiresAt: share.ExpiresAt });
            return;
          }
        }

        // Increment access count
        await this.incrementAccessCount(token).catch(err => {
          console.error('Failed to increment access count:', err);
          // Don't fail the request if increment fails
        });

        resolve({
          token: share.Token,
          query: share.SearchQuery,
          location: share.Location,
          minPrice: share.MinPrice,
          maxPrice: share.MaxPrice,
          createdAt: share.CreatedAt,
          expiresAt: share.ExpiresAt,
          createdBy: share.CreatedBy && share.CreatedBy.trim() !== ' ' ? share.CreatedBy : null,
          accessCount: share.AccessCount,
          isExpired: false,
        });
      });
    });
  }

  /**
   * Increment the access count for a shared search
   * @param {string} token - Share token
   */
  async incrementAccessCount(token) {
    const sql = 'UPDATE SharedSearchTokens SET AccessCount = AccessCount + 1 WHERE Token = ?';

    return new Promise((resolve, reject) => {
      db.query(sql, [token], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Delete a shared search (useful for cleanup)
   * @param {string} token - Share token
   * @returns {boolean} True if deleted, false if not found
   */
  async deleteSharedSearch(token) {
    const sql = 'DELETE FROM SharedSearchTokens WHERE Token = ?';

    return new Promise((resolve, reject) => {
      db.query(sql, [token], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result && result.affectedRows > 0);
        }
      });
    });
  }

  /**
   * Get shared searches created by a user
   * @param {number} userId - User ID
   * @returns {array} Array of shared searches
   */
  async getSharedSearchesByUser(userId) {
    const sql = `
      SELECT Token, SearchQuery, Location, MinPrice, MaxPrice,
             CreatedAt, ExpiresAt, AccessCount,
             CASE WHEN ExpiresAt IS NOT NULL AND ExpiresAt < NOW() THEN 1 ELSE 0 END as IsExpired
      FROM SharedSearchTokens
      WHERE CreatedBy = ?
      ORDER BY CreatedAt DESC
    `;

    return new Promise((resolve, reject) => {
      db.query(sql, [userId], (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results || []);
        }
      });
    });
  }

  /**
   * Delete expired tokens (cleanup task)
   * @returns {number} Number of deleted tokens
   */
  async deleteExpiredTokens() {
    const sql = 'DELETE FROM SharedSearchTokens WHERE ExpiresAt IS NOT NULL AND ExpiresAt < NOW()';

    return new Promise((resolve, reject) => {
      db.query(sql, [], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result && result.affectedRows ? result.affectedRows : 0);
        }
      });
    });
  }
}

module.exports = SharedSearchService;

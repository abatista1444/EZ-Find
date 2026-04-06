const db = require('../db');

function normalizeSavedSearchInput(payload = {}) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const query = typeof payload.query === 'string' ? payload.query.trim() : '';
  const location = typeof payload.location === 'string' ? payload.location.trim() : null;

  const minPriceNum = Number(payload.minPrice);
  const minPrice = Number.isFinite(minPriceNum) && minPriceNum >= 0 ? minPriceNum : null;

  const maxPriceNum = Number(payload.maxPrice);
  const maxPrice = Number.isFinite(maxPriceNum) && maxPriceNum >= 0 ? maxPriceNum : null;

  return {
    name,
    query,
    location: location || null,
    minPrice,
    maxPrice,
  };
}

class SavedSearchesService {
  constructor(database = db) {
    this.db = database;
  }

  async createSavedSearch(userId, payload) {
    const normalized = normalizeSavedSearchInput(payload);

    if (!normalized.name) {
      throw new Error('Search name is required');
    }
    if (!normalized.query) {
      throw new Error('Search query is required');
    }

    let result;
    try {
      [result] = await this.db.query(
        `INSERT INTO SavedSearches (
          userId,
          Name,
          Query,
          Location,
          MinPrice,
          MaxPrice
        )
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          normalized.name,
          normalized.query,
          normalized.location,
          normalized.minPrice,
          normalized.maxPrice,
        ]
      );
    } catch (error) {
      // Try alternative column names for backward compatibility
      if (error && error.code === 'ER_BAD_FIELD_ERROR') {
        [result] = await this.db.query(
          `INSERT INTO SavedSearches (
            userId,
            Name,
            Query,
            Location,
            MinPrice,
            MaxPrice
          )
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            userId,
            normalized.name,
            normalized.query,
            normalized.location,
            normalized.minPrice,
            normalized.maxPrice,
          ]
        );
      } else if (error && error.code === 'ER_DUP_ENTRY') {
        const err = new Error('A search with this name already exists');
        err.code = 'ER_DUP_ENTRY';
        throw err;
      } else {
        throw error;
      }
    }

    return {
      searchId: result.insertId,
      ...normalized,
      createdAt: new Date().toISOString(),
    };
  }

  async listSavedSearchesForUser(userId) {
    const [rows] = await this.db.query(
      `SELECT SavedSearch as SearchId, userId as UserId, Name, Query, Location, MinPrice, MaxPrice, CreatedAt, UpdatedAt
       FROM SavedSearches
       WHERE userId = ?
       ORDER BY CreatedAt DESC`,
      [userId]
    );

    return rows.map(row => ({
      searchId: row.SearchId,
      userId: row.UserId,
      name: row.Name,
      query: row.Query,
      location: row.Location || null,
      minPrice: row.MinPrice || null,
      maxPrice: row.MaxPrice || null,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
    }));
  }

  async updateSavedSearch(userId, searchId, payload) {
    const normalized = normalizeSavedSearchInput(payload);

    if (!normalized.name) {
      throw new Error('Search name is required');
    }
    if (!normalized.query) {
      throw new Error('Search query is required');
    }

    try {
      const [result] = await this.db.query(
        `UPDATE SavedSearches
         SET Name = ?, Query = ?, Location = ?, MinPrice = ?, MaxPrice = ?
         WHERE SavedSearch = ? AND userId = ?`,
        [
          normalized.name,
          normalized.query,
          normalized.location,
          normalized.minPrice,
          normalized.maxPrice,
          searchId,
          userId,
        ]
      );

      if (result.affectedRows === 0) {
        return false;
      }

      return true;
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        const err = new Error('A search with this name already exists');
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
      throw error;
    }
  }

  async deleteSavedSearch(userId, searchId) {
    const [result] = await this.db.query(
      `DELETE FROM SavedSearches
       WHERE SavedSearch = ? AND userId = ?`,
      [searchId, userId]
    );

    return result.affectedRows > 0;
  }
}

module.exports = {
  SavedSearchesService,
  normalizeSavedSearchInput,
};

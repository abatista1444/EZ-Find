const db = require('../db');

function normalizeSavedItemInput(payload = {}) {
  const rawExternalId = payload.externalItemId ?? payload.id;
  const externalItemId = typeof rawExternalId === 'string' ? rawExternalId.trim() : '';
  const itemName = typeof payload.title === 'string' ? payload.title.trim() : '';
  const itemDescription = typeof payload.description === 'string' ? payload.description.trim() : null;
  const source = typeof payload.source === 'string' ? payload.source.trim().toLowerCase() : '';
  const url = typeof payload.url === 'string' ? payload.url.trim() : '';
  const imageUrl = typeof payload.image === 'string' ? payload.image.trim() : null;
  const location = typeof payload.location === 'string' ? payload.location.trim() : null;

  const numericPrice = Number(payload.price);
  const price = Number.isFinite(numericPrice) && numericPrice >= 0 ? numericPrice : null;

  const postedAt = payload.postedAt ? new Date(payload.postedAt) : null;
  const normalizedPostedAt = postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null;

  return {
    externalItemId,
    itemName,
    itemDescription,
    source,
    url,
    imageUrl,
    location,
    price,
    postedAt: normalizedPostedAt,
  };
}

class SavedItemsService {
  constructor(database = db) {
    this.db = database;
  }

  async saveItemForUser(userId, payload) {
    const normalized = normalizeSavedItemInput(payload);

    let result;
    try {
      [result] = await this.db.query(
        `INSERT INTO SavedItems (
          UserId,
          ExternalItemId,
          ItemName,
          ItemDescription,
          Price,
          Url,
          Source,
          ImageUrl,
          Location,
          PostedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          normalized.externalItemId,
          normalized.itemName,
          normalized.itemDescription,
          normalized.price,
          normalized.url,
          normalized.source,
          normalized.imageUrl,
          normalized.location,
          normalized.postedAt,
        ]
      );
    } catch (error) {
      const missingDefaultField =
        error &&
        error.code === 'ER_NO_DEFAULT_FOR_FIELD' &&
        typeof error.sqlMessage === 'string' &&
        (error.sqlMessage.includes("Field 'Name' doesn't have a default value") ||
          error.sqlMessage.includes("Field 'Cost' doesn't have a default value"));

      if (!missingDefaultField) {
        throw error;
      }

      // Compatibility path for legacy schemas that still require Name/Cost.
      [result] = await this.db.query(
        `INSERT INTO SavedItems (
          UserId,
          ExternalItemId,
          ItemName,
          Name,
          ItemDescription,
          Price,
          Cost,
          Url,
          Source,
          ImageUrl,
          Location,
          PostedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          normalized.externalItemId,
          normalized.itemName,
          normalized.itemName || normalized.externalItemId,
          normalized.itemDescription,
          normalized.price,
          normalized.price,
          normalized.url,
          normalized.source,
          normalized.imageUrl,
          normalized.location,
          normalized.postedAt,
        ]
      );
    }

    return {
      itemId: result.insertId,
      ...normalized,
      dateSaved: new Date().toISOString(),
    };
  }

  async listSavedItemsForUser(userId) {
    const [rows] = await this.db.query(
      `SELECT
        UserId,
        ExternalItemId,
        ItemName,
        ItemDescription,
        Price,
        Url,
        Source,
        ImageUrl,
        Location,
        PostedAt,
        DateSaved
      FROM SavedItems
      WHERE UserId = ?
      ORDER BY DateSaved DESC`,
      [userId]
    );

    return rows.map(row => ({
      itemId: row.ItemId ?? null,
      userId: row.UserId,
      externalItemId: row.ExternalItemId,
      title: row.ItemName,
      description: row.ItemDescription,
      price: row.Price,
      url: row.Url,
      source: row.Source,
      image: row.ImageUrl,
      location: row.Location,
      postedAt: row.PostedAt,
      dateSaved: row.DateSaved,
    }));
  }

  async deleteSavedItemForUser(userId, externalItemId) {
    const [result] = await this.db.query(
      `DELETE FROM SavedItems
       WHERE UserId = ? AND ExternalItemId = ?`,
      [userId, externalItemId]
    );

    return result.affectedRows > 0;
  }
}

module.exports = {
  SavedItemsService,
  normalizeSavedItemInput,
};

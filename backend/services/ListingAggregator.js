const { MarketplaceError } = require('./listingTypes');

/**
 * Aggregator service that runs multiple marketplace connectors in parallel.
 * Accepts an array of connector instances (dependency injection) so it can be
 * tested with mocks.
 */
class ListingAggregator {
  /**
   * @param {Array<{search: function}>} connectors - objects implementing search(params) -> Promise<Listing[]>
   */
  constructor(connectors = []) {
    this.connectors = connectors;
  }

  /**
   * Search all configured marketplaces. Failures are collected and returned
   * alongside any successful listings.
   *
   * @param {import('./listingTypes').SearchParams} params
   * @returns {Promise<{listings: import('./listingTypes').Listing[], errors: MarketplaceError[]}>}
   */
  async searchAll(params) {
    console.log(`ListingAggregator: starting search for query="${params.query}", location="${params.location}"`);
    const promises = this.connectors.map(conn =>
      conn
        .search(params)
        .then(listings => ({ status: 'fulfilled', source: conn.getSourceName(), listings }))
        .catch(err => ({ status: 'rejected', source: conn.getSourceName(), error: err }))
    );

    const results = await Promise.all(promises);

    const listings = [];
    const errors = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (Array.isArray(r.listings)) {
          listings.push(...r.listings);
        } else {
          console.error(`Connector ${r.source} returned non-array result`, r.listings);
        }
      } else {
        console.error(`Error fetching from ${r.source}:`, r.error);
        errors.push({ source: r.source, message: r.error.message || String(r.error), original: r.error });
      }
    }

    // simple deduplication by url (could be extended later)
    const seen = new Set();
    const deduped = [];
    for (const item of listings) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      deduped.push(item);
    }

    return { listings: deduped, errors };
  }
}

module.exports = ListingAggregator;

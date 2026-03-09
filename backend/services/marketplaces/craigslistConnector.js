const ProviderCraigslistSource = require('./craigslistSources/ProviderCraigslistSource');
const RssCraigslistSource = require('./craigslistSources/RssCraigslistSource');
const ScrapeCraigslistSource = require('./craigslistSources/ScrapeCraigslistSource');

class CraigslistConnector {
  constructor(config = {}) {
    this.sources = config.sources || this._buildDefaultSources(config);
  }

  getSourceName() {
    return 'craigslist';
  }

  /**
   * @param {import('../listingTypes').SearchParams} params
   * @returns {Promise<import('../listingTypes').Listing[]>}
   */
  async search(params) {
    if (!params || !params.query) {
      throw new Error('Craigslist search requires a query');
    }

    const sourceErrors = [];
    let primaryListings = null;

    for (const source of this.sources) {
      try {
        const rawItems = await source.fetchRaw(params);
        const normalized = this._normalize(rawItems);
        if (normalized.length === 0) {
          continue;
        }

        if (!primaryListings) {
          primaryListings = normalized;
          if (!this._hasMissingImages(primaryListings)) {
            return primaryListings;
          }
          continue;
        }

        primaryListings = this._mergeMissingImages(primaryListings, normalized);
        if (!this._hasMissingImages(primaryListings)) {
          return primaryListings;
        }
      } catch (err) {
        sourceErrors.push(`[${source.getName()}] ${err.message}`);
      }
    }

    if (primaryListings) {
      return primaryListings;
    }

    throw new Error(`Craigslist search failed across all sources: ${sourceErrors.join('; ')}`);
  }

  _hasMissingImages(listings) {
    return listings.some(item => !item.image);
  }

  _mergeMissingImages(baseListings, enrichmentListings) {
    const imageByUrl = new Map();
    enrichmentListings.forEach(item => {
      if (item.url && item.image) {
        imageByUrl.set(item.url, item.image);
      }
    });

    if (imageByUrl.size === 0) {
      return baseListings;
    }

    return baseListings.map(item => {
      if (item.image || !item.url) {
        return item;
      }

      const backfilledImage = imageByUrl.get(item.url);
      if (!backfilledImage) {
        return item;
      }

      return {
        ...item,
        image: backfilledImage,
      };
    });
  }

  _buildDefaultSources(config) {
    const sources = [];
    const providerBaseUrl =
      config.providerBaseUrl ||
      process.env.CRAIGSLIST_PROVIDER_BASE_URL ||
      process.env.CRAIGSLIST_PROXY;
    const providerApiKey = config.providerApiKey || process.env.CRAIGSLIST_PROVIDER_API_KEY;

    if (providerBaseUrl) {
      sources.push(
        new ProviderCraigslistSource({
          baseUrl: providerBaseUrl,
          apiKey: providerApiKey,
        })
      );
    }

    sources.push(
      new RssCraigslistSource({
        defaultSite: config.defaultSite || process.env.CRAIGSLIST_DEFAULT_SITE || 'sfbay',
        enableDetailImageEnrichment: true,
      })
    );

    sources.push(
      new ScrapeCraigslistSource({
        defaultSite: config.defaultSite || process.env.CRAIGSLIST_DEFAULT_SITE || 'sfbay',
      })
    );

    return sources;
  }

  _normalize(raw) {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map(item => ({
        id: item.id || item.url,
        title: typeof item.title === 'string' ? item.title.trim() : '',
        price: this._toPrice(item.price),
        url: item.url,
        source: this.getSourceName(),
        image: this._toImage(item.image),
        location: item.location || undefined,
        postedAt: this._toDate(item.postedAt),
      }))
      .filter(item => item.id && item.title && item.url);
  }

  _toPrice(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const match = value.match(/([0-9][\d,]*(?:\.\d{1,2})?)/);
      if (match) {
        return Number(match[1].replace(/,/g, ''));
      }
    }

    return 0;
  }

  _toDate(value) {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  _toImage(value) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('data:')) {
      return undefined;
    }

    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }

    if (trimmed.startsWith('/')) {
      return `https://www.craigslist.org${trimmed}`;
    }

    if (/^images\.craigslist\.org\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }

    return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
  }
}

module.exports = CraigslistConnector;

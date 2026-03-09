const axios = require('axios');
const cheerio = require('cheerio');

class ScrapeCraigslistSource {
  constructor(config = {}) {
    this.defaultSite = config.defaultSite || 'sfbay';
    this.maxRetries = Number.isInteger(config.maxRetries) ? config.maxRetries : 1;
    this.client =
      config.httpClient ||
      axios.create({
        timeout: config.timeoutMs || 9000,
        headers: {
          'User-Agent':
            config.userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.craigslist.org/',
        },
      });
    this.cookieCacheTtlMs = config.cookieCacheTtlMs || 5 * 60 * 1000;
    this.cookieCache = new Map();
    this.maxItems = Number.isInteger(config.maxItems) ? config.maxItems : 120;
    this.imageEnrichmentLimit = Number.isInteger(config.imageEnrichmentLimit)
      ? config.imageEnrichmentLimit
      : this.maxItems;
    this.imageEnrichmentConcurrency = Number.isInteger(config.imageEnrichmentConcurrency)
      ? config.imageEnrichmentConcurrency
      : 6;
  }

  getName() {
    return 'scrape';
  }

  buildSearchUrl(params) {
    const site = this._sanitizeSite(params.location) || this.defaultSite;
    const search = new URLSearchParams({ query: params.query });
    return `https://${site}.craigslist.org/search/sss?${search.toString()}`;
  }

  buildGlobalSearchUrl(params) {
    const search = new URLSearchParams({ query: params.query });
    return `https://www.craigslist.org/search/sss?${search.toString()}`;
  }

  async fetchRaw(params) {
    const primaryUrl = this.buildSearchUrl(params);
    const fallbackUrl = this.buildGlobalSearchUrl(params);
    const html = await this._fetchWithFallback(primaryUrl, fallbackUrl);
    const parsed = this._parseHtml(html);

    if (parsed.length === 0) {
      throw new Error('Craigslist scrape produced no parsable listings');
    }

    await this._enrichMissingImages(parsed);

    return parsed;
  }

  _parseHtml(html) {
    const $ = cheerio.load(html);
    const selectors = [
      'li.cl-static-search-result',
      'li.cl-search-result',
      'li.result-row',
      'article.cl-search-result',
    ];

    let rows = $();
    for (const selector of selectors) {
      rows = $(selector);
      if (rows.length > 0) {
        break;
      }
    }

    const listings = [];
    rows.each((_, el) => {
      if (listings.length >= this.maxItems) {
        return false;
      }

      const row = $(el);
      const anchor = row.find('a.cl-app-anchor, a.posting-title, a.result-title, a[href*="/d/"]').first();
      const href = anchor.attr('href');
      const rawTitle = (anchor.text() || row.find('.result-title').first().text() || '').trim();
      const title = this._cleanTitle(rawTitle);

      if (!href || !title) {
        return;
      }

      const url = href.startsWith('http') ? href : `https://www.craigslist.org${href}`;
      const priceText =
        row.find('.price').first().text() ||
        row.find('.result-price').first().text() ||
        row.find('.meta .priceinfo').first().text() ||
        '';
      const location =
        row.find('.meta .location').first().text().trim() ||
        row.find('.result-hood').first().text().trim() ||
        undefined;
      const postedAt = row.find('time').first().attr('datetime') || undefined;
      const image = this._extractImage(row);

      listings.push({
        id: row.attr('data-pid') || url,
        title,
        price: this._parsePrice(priceText),
        url,
        image,
        location,
        postedAt,
      });
    });

    return listings;
  }

  _cleanTitle(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const firstMeaningfulLine = text
      .split('\n')
      .map(part => part.trim())
      .find(Boolean);

    return firstMeaningfulLine || text.replace(/\s+/g, ' ').trim();
  }

  _parsePrice(priceText) {
    if (!priceText || typeof priceText !== 'string') {
      return 0;
    }

    const match = priceText.match(/\$?([0-9][\d,]*(?:\.\d{1,2})?)/);
    if (!match) {
      return 0;
    }

    return Number(match[1].replace(/,/g, ''));
  }

  _extractImage(row) {
    const rawImg = row.find('img').first().attr('src') || row.find('img').first().attr('data-src');
    if (rawImg) {
      return this._absoluteImageUrl(rawImg);
    }

    const dataIds =
      row.attr('data-ids') ||
      row.find('[data-ids]').first().attr('data-ids') ||
      row.find('a.result-image').first().attr('data-ids') ||
      '';

    if (!dataIds) {
      return undefined;
    }

    const first = dataIds.split(',')[0].trim();
    const parts = first.split(':');
    const imageId = (parts.length > 1 ? parts[1] : parts[0]).trim();
    if (!imageId) {
      return undefined;
    }

    return this._absoluteImageUrl(`https://images.craigslist.org/${imageId}_300x300.jpg`);
  }

  async _enrichMissingImages(listings) {
    const targets = listings.filter(item => !item.image && item.url).slice(0, this.imageEnrichmentLimit);
    if (targets.length === 0) {
      return;
    }

    for (let i = 0; i < targets.length; i += this.imageEnrichmentConcurrency) {
      const batch = targets.slice(i, i + this.imageEnrichmentConcurrency);
      await Promise.all(
        batch.map(async item => {
          try {
            const html = await this._fetchDetailWithRetry(item.url);
            const image = this._extractImageFromDetailHtml(html);
            if (image) {
              item.image = image;
            }
          } catch (_error) {
            // Best-effort enrichment; keep listing even if image fetch fails.
          }
        })
      );
    }
  }

  _extractImageFromDetailHtml(html) {
    if (!html || typeof html !== 'string') {
      return undefined;
    }

    const $ = cheerio.load(html);
    const candidates = [
      $('meta[property="og:image"]').attr('content'),
      $('meta[name="twitter:image"]').attr('content'),
      $('#thumbs img').first().attr('src'),
      '.gallery img',
      '.slide img',
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      if (typeof candidate === 'string') {
        const normalized = this._absoluteImageUrl(candidate);
        if (normalized) {
          return normalized;
        }
        continue;
      }

      const src = $(candidate).first().attr('src');
      const normalized = this._absoluteImageUrl(src);
      if (normalized) {
        return normalized;
      }
    }

    return undefined;
  }

  async _fetchDetailWithRetry(url) {
    const cookieHeader = await this._getCookieHeader(url);
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.client.get(url, {
          headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await this._sleep(150 * (attempt + 1));
        }
      }
    }

    const err = new Error(`Detail page request failed after ${this.maxRetries + 1} attempts: ${lastError.message}`);
    err.original = lastError;
    throw err;
  }

  _absoluteImageUrl(raw) {
    if (!raw || typeof raw !== 'string') {
      return undefined;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.startsWith('data:')) {
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

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return undefined;
  }

  async _fetchWithFallback(primaryUrl, fallbackUrl) {
    try {
      return await this._fetchWithRetry(primaryUrl);
    } catch (primaryError) {
      if (!fallbackUrl || fallbackUrl === primaryUrl) {
        throw primaryError;
      }

      const status = primaryError.original && primaryError.original.response
        ? primaryError.original.response.status
        : undefined;

      if (status !== 403 && status !== 404) {
        throw primaryError;
      }

      return this._fetchWithRetry(fallbackUrl);
    }
  }

  async _fetchWithRetry(url) {
    const cookieHeader = await this._getCookieHeader(url);
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.client.get(url, {
          headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await this._sleep(250 * (attempt + 1));
        }
      }
    }

    const err = new Error(`Scrape request failed after ${this.maxRetries + 1} attempts: ${lastError.message}`);
    err.original = lastError;
    throw err;
  }

  async _getCookieHeader(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.host;
      const cached = this.cookieCache.get(host);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }

      const response = await this.client.get(`${parsed.protocol}//${parsed.host}/`);
      const rawCookies = Array.isArray(response.headers['set-cookie'])
        ? response.headers['set-cookie']
        : [];
      const cookieHeader = rawCookies
        .map(cookie => cookie.split(';')[0])
        .filter(Boolean)
        .join('; ');

      if (cookieHeader) {
        this.cookieCache.set(host, {
          value: cookieHeader,
          expiresAt: Date.now() + this.cookieCacheTtlMs,
        });
      }

      return cookieHeader;
    } catch (_error) {
      return '';
    }
  }

  _sanitizeSite(location) {
    if (!location || typeof location !== 'string') {
      return null;
    }

    const firstToken = location.split(/[\s,]+/).find(Boolean);
    if (!firstToken) {
      return null;
    }

    const normalized = firstToken.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return normalized || null;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ScrapeCraigslistSource;

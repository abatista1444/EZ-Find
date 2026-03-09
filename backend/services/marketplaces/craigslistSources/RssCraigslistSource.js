const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio');

class RssCraigslistSource {
  constructor(config = {}) {
    this.defaultSite = config.defaultSite || 'sfbay';
    this.maxRetries = Number.isInteger(config.maxRetries) ? config.maxRetries : 1;
    this.client =
      config.httpClient ||
      axios.create({
        timeout: config.timeoutMs || 7000,
        headers: {
          'User-Agent':
            config.userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.craigslist.org/',
        },
      });
    this.parser = config.rssParser || new Parser();
    this.cookieCacheTtlMs = config.cookieCacheTtlMs || 5 * 60 * 1000;
    this.cookieCache = new Map();
    this.cookieProvider = config.cookieProvider || (url => this._getCookieHeader(url));
    this.enableDetailImageEnrichment = Boolean(config.enableDetailImageEnrichment);
    this.imageEnrichmentLimit = Number.isInteger(config.imageEnrichmentLimit)
      ? config.imageEnrichmentLimit
      : 80;
    this.imageEnrichmentConcurrency = Number.isInteger(config.imageEnrichmentConcurrency)
      ? config.imageEnrichmentConcurrency
      : 4;
  }

  getName() {
    return 'rss';
  }

  buildSearchUrl(params) {
    const site = this._sanitizeSite(params.location) || this.defaultSite;
    const search = new URLSearchParams({
      query: params.query,
      format: 'rss',
    });
    return `https://${site}.craigslist.org/search/sss?${search.toString()}`;
  }

  async fetchRaw(params) {
    const url = this.buildSearchUrl(params);
    const fallbackUrl = this.buildGlobalSearchUrl(params);
    const xml = await this._fetchWithFallback(url, fallbackUrl);
    const feed = await this.parser.parseString(xml);
    const items = Array.isArray(feed.items) ? feed.items : [];

    const rawItems = items
      .map(item => this._toRawItem(item))
      .filter(item => item && item.url && item.title);

    if (this.enableDetailImageEnrichment) {
      await this._enrichMissingImages(rawItems);
    }

    return rawItems;
  }

  buildGlobalSearchUrl(params) {
    const search = new URLSearchParams({
      query: params.query,
      format: 'rss',
    });
    return `https://www.craigslist.org/search/sss?${search.toString()}`;
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
    const cookieHeader = await this.cookieProvider(url);
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
          await this._sleep(200 * (attempt + 1));
        }
      }
    }

    const status = lastError && lastError.response ? lastError.response.status : undefined;
    const providerHint =
      status === 403
        ? ' Craigslist RSS access is blocked from this network (HTTP 403). The connector will continue with HTML scraping fallback.'
        : '';
    const err = new Error(
      `RSS request failed after ${this.maxRetries + 1} attempts: ${lastError.message}.${providerHint}`.trim()
    );
    err.original = lastError;
    throw err;
  }

  _toRawItem(item) {
    if (!item || !item.link || !item.title) {
      return null;
    }

    const price = this._extractPrice(item.title) ?? this._extractPrice(item.contentSnippet) ?? 0;
    return {
      id: item.guid || item.link,
      title: item.title.trim(),
      price,
      url: item.link,
      image: this._extractImage(item),
      location: this._extractLocation(item.contentSnippet),
      postedAt: item.isoDate || item.pubDate || undefined,
    };
  }

  _extractPrice(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    const match = text.match(/\$([0-9][\d,]*(?:\.\d{1,2})?)/);
    if (!match) {
      return null;
    }

    return Number(match[1].replace(/,/g, ''));
  }

  _extractImage(item) {
    if (item.enclosure && item.enclosure.url) {
      return this._normalizeImageUrl(item.enclosure.url);
    }

    const html = typeof item.content === 'string' ? item.content : '';
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return this._normalizeImageUrl(match ? match[1] : undefined);
  }

  _normalizeImageUrl(raw) {
    if (!raw || typeof raw !== 'string') {
      return undefined;
    }

    const trimmed = raw.trim();
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

  _extractLocation(snippet) {
    if (!snippet || typeof snippet !== 'string') {
      return undefined;
    }

    const match = snippet.match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim() : undefined;
  }

  async _enrichMissingImages(items) {
    const targets = items.filter(item => !item.image && item.url).slice(0, this.imageEnrichmentLimit);
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
            // Best-effort enrichment only.
          }
        })
      );
    }
  }

  async _fetchDetailWithRetry(url) {
    const cookieHeader = await this.cookieProvider(url);
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

    throw lastError;
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
      $('.gallery img').first().attr('src'),
      $('.slide img').first().attr('src'),
    ];

    for (const candidate of candidates) {
      const normalized = this._normalizeImageUrl(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return undefined;
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

  async _getCookieHeader(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.host;
      const cached = this.cookieCache.get(host);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }

      const origin = `${parsed.protocol}//${parsed.host}`;
      const response = await this.client.get(`${origin}/`, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

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
}

module.exports = RssCraigslistSource;

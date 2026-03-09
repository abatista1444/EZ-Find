const axios = require('axios');

class ProviderCraigslistSource {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.client = config.httpClient || axios.create({ timeout: config.timeoutMs || 7000 });
  }

  getName() {
    return 'provider';
  }

  async fetchRaw(params) {
    if (!this.baseUrl) {
      throw new Error('Provider base URL is required');
    }

    const response = await this.client.get(`${this.baseUrl.replace(/\/$/, '')}/search`, {
      params: {
        q: params.query,
        location: params.location,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
      },
      headers: this.apiKey ? { 'x-api-key': this.apiKey } : undefined,
    });

    if (Array.isArray(response.data)) {
      return response.data;
    }

    if (response.data && Array.isArray(response.data.items)) {
      return response.data.items;
    }

    throw new Error('Provider returned unsupported payload');
  }
}

module.exports = ProviderCraigslistSource;

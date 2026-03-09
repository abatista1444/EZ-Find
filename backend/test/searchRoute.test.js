const request = require('supertest');

jest.mock('../services/marketplaces/craigslistConnector', () => {
  return jest.fn().mockImplementation(() => ({
    getSourceName: () => 'craigslist',
    search: () => Promise.reject(new Error('rss unavailable')),
  }));
});

const app = require('../server');

describe('Search API route', () => {
  it('returns 400 if query parameter is missing', async () => {
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Missing required query parameter/);
  });

  it('returns normalized listings and errors array when query provided', async () => {
    const res = await request(app).get('/api/search').query({ q: 'test' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.listings)).toBe(true);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.listings).toHaveLength(0);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'craigslist' }),
      ])
    );
    const hasSyntheticCraigslistListing = res.body.listings.some(item => item.source === 'craigslist');
    expect(hasSyntheticCraigslistListing).toBe(false);
  });
});

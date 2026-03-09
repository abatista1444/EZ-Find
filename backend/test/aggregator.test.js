const ListingAggregator = require('../services/ListingAggregator');

describe('ListingAggregator', () => {
  it('returns combined listings from all connectors and captures errors', async () => {
    const connectors = [
      {
        getSourceName: () => 'craigslist',
        search: () => Promise.resolve([{ id: 'cl-1', title: 'cl item', url: 'https://example.com/cl-1', source: 'craigslist' }]),
      },
      { search: () => Promise.reject(new Error('simulated fail')), getSourceName: () => 'broken' },
    ];
    const agg = new ListingAggregator(connectors);
    const { listings, errors } = await agg.searchAll({ query: 'bike' });

    expect(Array.isArray(listings)).toBe(true);
    expect(listings.length).toBe(1);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'broken' }),
      ])
    );
  });

  it('deduplicates listings with same URL', async () => {
    // two connectors return items with same URL
    const dupUrl = 'https://example.com/item/dup';
    const c1 = { search: () => Promise.resolve([{ id: '1', url: dupUrl, source: 'a' }]), getSourceName: () => 'a' };
    const c2 = { search: () => Promise.resolve([{ id: '2', url: dupUrl, source: 'b' }]), getSourceName: () => 'b' };
    const agg = new ListingAggregator([c1, c2]);
    const { listings } = await agg.searchAll({ query: 'x' });
    expect(listings.length).toBe(1);
    expect(listings[0].url).toBe(dupUrl);
  });
});

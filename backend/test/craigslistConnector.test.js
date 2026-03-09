const CraigslistConnector = require('../services/marketplaces/craigslistConnector');

describe('CraigslistConnector', () => {
  it('falls back to next source when the first source fails', async () => {
    const providerSource = {
      getName: () => 'provider',
      fetchRaw: jest.fn().mockRejectedValue(new Error('provider down')),
    };
    const rssSource = {
      getName: () => 'rss',
      fetchRaw: jest.fn().mockResolvedValue([
        {
          id: 'cl-1',
          title: '$125 Trek bike',
          price: 125,
          url: 'https://sfbay.craigslist.org/abc',
          postedAt: '2026-03-09T00:00:00.000Z',
        },
      ]),
    };

    const connector = new CraigslistConnector({ sources: [providerSource, rssSource] });
    const listings = await connector.search({ query: 'bike', location: 'sfbay' });

    expect(providerSource.fetchRaw).toHaveBeenCalledTimes(1);
    expect(rssSource.fetchRaw).toHaveBeenCalledTimes(1);
    expect(listings).toHaveLength(1);
    expect(listings[0]).toEqual(
      expect.objectContaining({
        id: 'cl-1',
        source: 'craigslist',
        price: 125,
      })
    );
    expect(listings[0].postedAt).toBeInstanceOf(Date);
  });

  it('throws when all sources fail and does not return synthetic listings', async () => {
    const source = {
      getName: () => 'rss',
      fetchRaw: jest.fn().mockRejectedValue(new Error('network error')),
    };

    const connector = new CraigslistConnector({ sources: [source] });
    await expect(connector.search({ query: 'bike' })).rejects.toThrow(/failed across all sources/i);
  });

  it('normalizes numeric values and filters invalid records', async () => {
    const source = {
      getName: () => 'rss',
      fetchRaw: jest.fn().mockResolvedValue([
        { id: '1', title: 'Valid', price: '$1,200', url: 'https://example.com/1', postedAt: 'bad-date' },
        { id: '2', title: '', price: 50, url: 'https://example.com/2' },
      ]),
    };

    const connector = new CraigslistConnector({ sources: [source] });
    const listings = await connector.search({ query: 'bike' });

    expect(listings).toHaveLength(1);
    expect(listings[0].price).toBe(1200);
    expect(listings[0].postedAt).toBeUndefined();
  });

  it('falls back from RSS to scraper when RSS is blocked', async () => {
    const rssSource = {
      getName: () => 'rss',
      fetchRaw: jest.fn().mockRejectedValue(new Error('403 forbidden')),
    };
    const scrapeSource = {
      getName: () => 'scrape',
      fetchRaw: jest.fn().mockResolvedValue([
        {
          id: 'cl-2',
          title: 'Scraped Bike',
          price: '350',
          url: 'https://sfbay.craigslist.org/item/2',
          postedAt: '2026-03-08T00:00:00.000Z',
        },
      ]),
    };

    const connector = new CraigslistConnector({ sources: [rssSource, scrapeSource] });
    const listings = await connector.search({ query: 'bike', location: 'sfbay' });

    expect(rssSource.fetchRaw).toHaveBeenCalledTimes(1);
    expect(scrapeSource.fetchRaw).toHaveBeenCalledTimes(1);
    expect(listings).toHaveLength(1);
    expect(listings[0]).toEqual(
      expect.objectContaining({
        id: 'cl-2',
        source: 'craigslist',
        price: 350,
      })
    );
  });

  it('normalizes image URL shape during connector normalization', async () => {
    const source = {
      getName: () => 'rss',
      fetchRaw: jest.fn().mockResolvedValue([
        {
          id: 'cl-3',
          title: 'Image normalization listing',
          price: 99,
          url: 'https://sfbay.craigslist.org/item/3',
          image: '//images.craigslist.org/abc_300x300.jpg',
        },
        {
          id: 'cl-4',
          title: 'Bad image listing',
          price: 55,
          url: 'https://sfbay.craigslist.org/item/4',
          image: 'data:image/png;base64,abc',
        },
      ]),
    };

    const connector = new CraigslistConnector({ sources: [source] });
    const listings = await connector.search({ query: 'bike' });

    expect(listings).toHaveLength(2);
    expect(listings[0].image).toBe('https://images.craigslist.org/abc_300x300.jpg');
    expect(listings[1].image).toBeUndefined();
  });

  it('backfills missing images from later sources when primary source has gaps', async () => {
    const rssSource = {
      getName: () => 'rss',
      fetchRaw: jest.fn().mockResolvedValue([
        {
          id: 'cl-10',
          title: 'Primary listing without image',
          price: 250,
          url: 'https://sfbay.craigslist.org/item/10',
          image: undefined,
        },
      ]),
    };

    const scrapeSource = {
      getName: () => 'scrape',
      fetchRaw: jest.fn().mockResolvedValue([
        {
          id: 'cl-10-scrape',
          title: 'Primary listing without image',
          price: 250,
          url: 'https://sfbay.craigslist.org/item/10',
          image: 'https://images.craigslist.org/abc_600x450.jpg',
        },
      ]),
    };

    const connector = new CraigslistConnector({ sources: [rssSource, scrapeSource] });
    const listings = await connector.search({ query: 'bike', location: 'sfbay' });

    expect(rssSource.fetchRaw).toHaveBeenCalledTimes(1);
    expect(scrapeSource.fetchRaw).toHaveBeenCalledTimes(1);
    expect(listings).toHaveLength(1);
    expect(listings[0].image).toBe('https://images.craigslist.org/abc_600x450.jpg');
  });
});

const RssCraigslistSource = require('../services/marketplaces/craigslistSources/RssCraigslistSource');

describe('RssCraigslistSource', () => {
  it('falls back to global Craigslist RSS URL when site-specific URL is blocked', async () => {
    const client = {
      get: jest
        .fn()
        .mockRejectedValueOnce({ message: 'Forbidden', response: { status: 403 } })
        .mockResolvedValueOnce({ data: '<?xml version="1.0"?><rss version="2.0"><channel><item><title>$100 Bike</title><link>https://example.com/item/1</link><guid>g1</guid><pubDate>Mon, 09 Mar 2026 00:00:00 GMT</pubDate></item></channel></rss>' }),
    };

    const source = new RssCraigslistSource({
      httpClient: client,
      maxRetries: 0,
      defaultSite: 'sfbay',
      cookieProvider: async () => '',
    });

    const items = await source.fetchRaw({ query: 'bike', location: 'blocked-site' });

    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.get.mock.calls[0][0]).toContain('https://blocked-site.craigslist.org/search/sss');
    expect(client.get.mock.calls[1][0]).toContain('https://www.craigslist.org/search/sss');
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        title: '$100 Bike',
        url: 'https://example.com/item/1',
      })
    );
  });

  it('normalizes enclosure and content image URLs', () => {
    const source = new RssCraigslistSource();

    expect(source._normalizeImageUrl('//images.craigslist.org/abc_300x300.jpg')).toBe(
      'https://images.craigslist.org/abc_300x300.jpg'
    );
    expect(source._normalizeImageUrl('images.craigslist.org/abc_300x300.jpg')).toBe(
      'https://images.craigslist.org/abc_300x300.jpg'
    );
    expect(source._normalizeImageUrl('/images/abc.jpg')).toBe('https://www.craigslist.org/images/abc.jpg');
  });

  it('filters invalid RSS image URLs', () => {
    const source = new RssCraigslistSource();

    expect(source._normalizeImageUrl('data:image/png;base64,abc')).toBeUndefined();
    expect(source._normalizeImageUrl('mailto:test@example.com')).toBeUndefined();
  });

  it('enriches missing image from listing detail page when enabled', async () => {
    const rssXml = '<?xml version="1.0"?><rss version="2.0"><channel><item><title>$200 Bike</title><link>https://example.com/item/42</link><guid>g42</guid><pubDate>Mon, 09 Mar 2026 00:00:00 GMT</pubDate><description>No image in feed</description></item></channel></rss>';
    const detailHtml = '<html><head><meta property="og:image" content="https://images.craigslist.org/enriched_600x450.jpg" /></head><body></body></html>';

    const client = {
      get: jest
        .fn()
        .mockResolvedValueOnce({ data: rssXml })
        .mockResolvedValueOnce({ data: detailHtml }),
    };

    const source = new RssCraigslistSource({
      httpClient: client,
      maxRetries: 0,
      defaultSite: 'sfbay',
      cookieProvider: async () => '',
      enableDetailImageEnrichment: true,
      imageEnrichmentLimit: 1,
      imageEnrichmentConcurrency: 1,
    });

    const items = await source.fetchRaw({ query: 'bike', location: 'sfbay' });

    expect(items).toHaveLength(1);
    expect(items[0].image).toBe('https://images.craigslist.org/enriched_600x450.jpg');
  });
});

const ScrapeCraigslistSource = require('../services/marketplaces/craigslistSources/ScrapeCraigslistSource');

describe('ScrapeCraigslistSource', () => {
  it('parses listing rows from Craigslist HTML', async () => {
    const html = `
      <html>
        <body>
          <ul>
            <li class="cl-static-search-result" data-pid="123">
              <a class="cl-app-anchor" href="https://sfbay.craigslist.org/xyz">Road Bike</a>
              <div class="meta"><span class="price">$450</span><span class="location">San Jose</span></div>
              <time datetime="2026-03-09T00:00:00.000Z"></time>
              <img src="https://images.example/bike.jpg" />
            </li>
          </ul>
        </body>
      </html>
    `;

    const client = {
      get: jest.fn()
        .mockResolvedValueOnce({ headers: { 'set-cookie': ['a=b; Path=/'] } })
        .mockResolvedValueOnce({ data: html }),
    };

    const source = new ScrapeCraigslistSource({
      httpClient: client,
      maxRetries: 0,
      defaultSite: 'sfbay',
    });

    const items = await source.fetchRaw({ query: 'bike', location: 'sfbay' });

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: '123',
        title: 'Road Bike',
        price: 450,
        location: 'San Jose',
      })
    );
  });

  it('builds image url from data-ids when image tag is absent', async () => {
    const html = `
      <html>
        <body>
          <ul>
            <li class="cl-static-search-result" data-pid="456">
              <a class="cl-app-anchor" href="https://sfbay.craigslist.org/abc">Gaming Laptop</a>
              <a class="result-image gallery" data-ids="1:00A0A_bXc12345678,1:00b0b_other"></a>
              <div class="meta"><span class="price">$700</span><span class="location">Palo Alto</span></div>
            </li>
          </ul>
        </body>
      </html>
    `;

    const client = {
      get: jest.fn()
        .mockResolvedValueOnce({ headers: { 'set-cookie': ['a=b; Path=/'] } })
        .mockResolvedValueOnce({ data: html }),
    };

    const source = new ScrapeCraigslistSource({
      httpClient: client,
      maxRetries: 0,
      defaultSite: 'sfbay',
    });

    const items = await source.fetchRaw({ query: 'laptop', location: 'sfbay' });

    expect(items).toHaveLength(1);
    expect(items[0].image).toBe('https://images.craigslist.org/00A0A_bXc12345678_300x300.jpg');
  });

  it('enriches missing image from listing detail page', async () => {
    const searchHtml = `
      <html>
        <body>
          <ul>
            <li class="cl-static-search-result" data-pid="789">
              <a class="cl-app-anchor" href="https://sfbay.craigslist.org/sby/ele/d/sunnyvale-gaming-laptop/123.html">Gaming Laptop</a>
              <div class="meta"><span class="price">$900</span></div>
            </li>
          </ul>
        </body>
      </html>
    `;

    const detailHtml = `
      <html>
        <head>
          <meta property="og:image" content="https://images.craigslist.org/00A0A_detail_600x450.jpg" />
        </head>
        <body></body>
      </html>
    `;

    const client = {
      get: jest.fn()
        .mockResolvedValueOnce({ headers: { 'set-cookie': ['a=b; Path=/'] } })
        .mockResolvedValueOnce({ data: searchHtml })
        .mockResolvedValueOnce({ data: detailHtml }),
    };

    const source = new ScrapeCraigslistSource({
      httpClient: client,
      maxRetries: 0,
      defaultSite: 'sfbay',
      imageEnrichmentLimit: 1,
      imageEnrichmentConcurrency: 1,
    });

    const items = await source.fetchRaw({ query: 'laptop', location: 'sfbay' });

    expect(items).toHaveLength(1);
    expect(items[0].image).toBe('https://images.craigslist.org/00A0A_detail_600x450.jpg');
  });

  it('normalizes protocol-relative and bare craigslist image URLs', () => {
    const source = new ScrapeCraigslistSource();

    expect(source._absoluteImageUrl('//images.craigslist.org/abc_300x300.jpg')).toBe(
      'https://images.craigslist.org/abc_300x300.jpg'
    );
    expect(source._absoluteImageUrl('images.craigslist.org/abc_300x300.jpg')).toBe(
      'https://images.craigslist.org/abc_300x300.jpg'
    );
  });

  it('rejects unsupported image URL formats', () => {
    const source = new ScrapeCraigslistSource();

    expect(source._absoluteImageUrl('data:image/png;base64,abc')).toBeUndefined();
    expect(source._absoluteImageUrl('ftp://example.com/image.jpg')).toBeUndefined();
    expect(source._absoluteImageUrl('')).toBeUndefined();
  });
});

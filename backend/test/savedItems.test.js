const request = require('supertest');

const mockQuery = jest.fn();

jest.mock('../db', () => ({
  query: (...args) => mockQuery(...args),
  getConnection: jest.fn(),
}));

jest.mock('express-session', () => {
  return () => (req, _res, next) => {
    const headerValue = req.headers['x-test-user-id'];
    const parsedUserId = Number(headerValue);

    req.session = {
      userId: Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : undefined,
      destroy: callback => callback && callback(),
      regenerate: callback => callback && callback(),
    };

    next();
  };
});

const app = require('../server');

describe('Saved Items API route', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns 401 if request is unauthenticated', async () => {
    const res = await request(app).get('/api/saved-items');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Not authenticated/i);
  });

  it('creates a saved item for an authenticated user', async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 10 }]);

    const payload = {
      externalItemId: 'cl-100',
      title: 'Road Bike',
      description: 'Used but in great condition',
      price: 175,
      url: 'https://example.com/item/road-bike',
      source: 'craigslist',
      image: 'https://example.com/img.jpg',
      location: 'Seattle, WA',
      postedAt: '2026-03-08T10:00:00.000Z',
    };

    const res = await request(app)
      .post('/api/saved-items')
      .set('x-test-user-id', '7')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/saved successfully/i);
    expect(res.body.savedItem.externalItemId).toBe('cl-100');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when duplicate save is attempted', async () => {
    mockQuery.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    const res = await request(app)
      .post('/api/saved-items')
      .set('x-test-user-id', '7')
      .send({
        externalItemId: 'cl-100',
        title: 'Road Bike',
        url: 'https://example.com/item/road-bike',
        source: 'craigslist',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already saved/i);
  });

  it('lists saved items for the authenticated user', async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          ItemId: 10,
          UserId: 7,
          ExternalItemId: 'cl-100',
          ItemName: 'Road Bike',
          ItemDescription: 'Used but in great condition',
          Price: 175,
          Url: 'https://example.com/item/road-bike',
          Source: 'craigslist',
          ImageUrl: 'https://example.com/img.jpg',
          Location: 'Seattle, WA',
          PostedAt: '2026-03-08T10:00:00.000Z',
          DateSaved: '2026-03-09T10:00:00.000Z',
        },
      ],
    ]);

    const res = await request(app)
      .get('/api/saved-items')
      .set('x-test-user-id', '7');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].externalItemId).toBe('cl-100');
  });

  it('removes an owned saved item by external item id', async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .delete('/api/saved-items/cl-100')
      .set('x-test-user-id', '7');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);
  });

  it('returns 404 when deleting an item that does not belong to user', async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await request(app)
      .delete('/api/saved-items/cl-999')
      .set('x-test-user-id', '7');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});

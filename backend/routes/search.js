const express = require('express');
const ListingAggregator = require('../services/ListingAggregator');
const CraigslistConnector = require('../services/marketplaces/craigslistConnector');

const router = express.Router();

// Craigslist is the only active marketplace connector.
const connectors = [
  new CraigslistConnector({
    providerBaseUrl: process.env.CRAIGSLIST_PROVIDER_BASE_URL || process.env.CRAIGSLIST_PROXY,
    providerApiKey: process.env.CRAIGSLIST_PROVIDER_API_KEY,
    defaultSite: process.env.CRAIGSLIST_DEFAULT_SITE || 'sfbay',
  }),
];
const aggregator = new ListingAggregator(connectors);

// Simple parameter validation middleware
function validateQuery(req, res, next) {
  if (!req.query || !req.query.q) {
    return res.status(400).json({ message: 'Missing required query parameter `q`' });
  }
  next();
}

// GET /api/search?q=term&location=...
router.get('/', validateQuery, async (req, res, next) => {
  const params = {
    query: req.query.q,
    location: req.query.location,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    extras: {},
  };

  console.log(`Search route: processing request for query="${params.query}", location="${params.location}"`);

  try {
    const { listings, errors } = await aggregator.searchAll(params);
    res.json({ listings, errors });
  } catch (err) {
    // This shouldn't happen since searchAll handles its own errors, but just in case
    next(err);
  }
});

module.exports = router;

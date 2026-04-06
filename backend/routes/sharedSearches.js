const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('./auth');
const SharedSearchService = require('../services/sharedSearchService');

const router = express.Router();
const sharedSearchService = new SharedSearchService();

function validate(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }

  return res.status(422).json({ errors: errors.array() });
}

function getBaseUrl(req) {
  const protocol = req.secure ? 'https' : 'http';
  const host = req.get('host');
  return `${protocol}://${host}`;
}

/**
 * POST /api/shared-searches
 * Create a new shareable search token
 * Requires: authentication
 */
router.post(
  '/',
  requireAuth,
  [
    body('query').trim().notEmpty().withMessage('query is required'),
    body('location').optional().trim(),
    body('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a positive number'),
    body('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a positive number'),
    body('expiresAt').optional().isISO8601().withMessage('expiresAt must be a valid ISO date'),
  ],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    try {
      const { query, location, minPrice, maxPrice, expiresAt } = req.body;

      // Validate that maxPrice >= minPrice if both provided
      if (minPrice && maxPrice && parseFloat(minPrice) > parseFloat(maxPrice)) {
        return res.status(422).json({ message: 'minPrice must be less than or equal to maxPrice' });
      }

      // Create shared search
      const result = await sharedSearchService.createSharedSearch(
        req.session.userId,
        { query, location: location || null, minPrice: minPrice ? parseFloat(minPrice) : null, maxPrice: maxPrice ? parseFloat(maxPrice) : null },
        expiresAt || null
      );

      const baseUrl = getBaseUrl(req);
      const shareUrl = `${baseUrl}/search/${result.token}`;

      res.status(201).json({
        token: result.token,
        shareUrl,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      console.error('POST /api/shared-searches error:', err);
      return res.status(500).json({ message: 'Failed to create shared search' });
    }
  }
);

/**
 * GET /api/shared-searches/:token
 * Retrieve search parameters for a shared search (public endpoint)
 * No authentication required
 */
router.get(
  '/:token',
  [param('token').trim().notEmpty().withMessage('token is required')],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    try {
      const { token } = req.params;
      const shared = await sharedSearchService.getSharedSearch(token);

      if (!shared) {
        return res.status(404).json({ message: 'Shared search not found' });
      }

      if (shared.isExpired) {
        return res.status(410).json({ message: 'Shared search has expired', expiresAt: shared.expiresAt });
      }

      // Return only necessary fields for search
      res.json({
        token: shared.token,
        query: shared.query,
        location: shared.location,
        minPrice: shared.minPrice,
        maxPrice: shared.maxPrice,
        createdAt: shared.createdAt,
        expiresAt: shared.expiresAt,
        createdBy: shared.createdBy,
        isExpired: false,
      });
    } catch (err) {
      console.error('GET /api/shared-searches/:token error:', err);
      return res.status(500).json({ message: 'Failed to retrieve shared search' });
    }
  }
);

/**
 * GET /api/shared-searches/user/my-shares
 * List shared searches created by the current user
 * Requires: authentication
 */
router.get(
  '/user/my-shares',
  requireAuth,
  async (req, res) => {
    try {
      const shares = await sharedSearchService.getSharedSearchesByUser(req.session.userId);
      res.json({ shares });
    } catch (err) {
      console.error('GET /api/shared-searches/user/my-shares error:', err);
      return res.status(500).json({ message: 'Failed to retrieve your shared searches' });
    }
  }
);

module.exports = router;

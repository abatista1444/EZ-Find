const express = require('express');
const { body, validationResult } = require('express-validator');

const { requireAuth } = require('./auth');
const { SavedItemsService } = require('../services/savedItemsService');
const { SuggestionsService } = require('../services/suggestionsService');

const router = express.Router();

// Initialize services
const savedItemsService = new SavedItemsService();
const suggestionsService = new SuggestionsService(savedItemsService);

function validate(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }

  return res.status(422).json({ errors: errors.array() });
}

/**
 * POST /api/suggestions
 * Get personalized suggestions based on user's saved items and recent search results.
 * Uses content-based filtering without making new marketplace searches.
 *
 * Body:
 *   - recentResults: Array - recent listing objects from frontend searches
 *   - limit: number (default 10) - max suggestions to return
 */
router.post(
  '/',
  requireAuth,
  [
    body('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    body('recentResults').optional().isArray()
  ],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    const limit = req.body.limit || 10;
    const recentResults = Array.isArray(req.body.recentResults) ? req.body.recentResults : [];

    try {
      const { suggestions, metadata } = await suggestionsService.generateSuggestionsForUser(
        req.session.userId,
        recentResults,
        { limit }
      );

      res.json({ suggestions, metadata });
    } catch (err) {
      console.error('POST /api/suggestions error:', err);
      res.status(500).json({ message: 'Failed to generate suggestions' });
    }
  }
);

module.exports = router;

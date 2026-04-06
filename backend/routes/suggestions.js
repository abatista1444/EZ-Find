const express = require('express');
const { query, validationResult } = require('express-validator');

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
 * GET /api/suggestions
 * Get personalized suggestions based on user's saved items and recent search results.
 * Uses content-based filtering without making new marketplace searches.
 *
 * Query params:
 *   - limit: number (default 10) - max suggestions to return
 *   - recentResults: JSON string - Array of recent listing objects from frontend
 */
router.get(
  '/',
  requireAuth,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('recentResults').optional().isString()
  ],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    const limit = req.query.limit || 10;
    let recentResults = [];

    // Parse recent search results from query string
    if (req.query.recentResults) {
      try {
        recentResults = JSON.parse(req.query.recentResults);
        if (!Array.isArray(recentResults)) {
          recentResults = [];
        }
      } catch (err) {
        console.warn('Failed to parse recentResults:', err);
        recentResults = [];
      }
    }

    try {
      const { suggestions, metadata } = await suggestionsService.generateSuggestionsForUser(
        req.session.userId,
        recentResults,
        { limit }
      );

      res.json({ suggestions, metadata });
    } catch (err) {
      console.error('GET /api/suggestions error:', err);
      res.status(500).json({ message: 'Failed to generate suggestions' });
    }
  }
);

module.exports = router;

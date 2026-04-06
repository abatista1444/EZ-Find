const express = require('express');
const { body, param, validationResult } = require('express-validator');

const { requireAuth } = require('./auth');
const { SavedSearchesService } = require('../services/savedSearchesService');

const router = express.Router();
const savedSearchesService = new SavedSearchesService();

function validate(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }

  return res.status(422).json({ errors: errors.array() });
}

// POST /api/saved-searches - Create a new saved search
router.post(
  '/',
  requireAuth,
  [
    body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 255 }).withMessage('name must be at most 255 characters'),
    body('query').trim().notEmpty().withMessage('query is required').isLength({ max: 500 }).withMessage('query must be at most 500 characters'),
    body('location').optional().trim().isLength({ max: 255 }).withMessage('location must be at most 255 characters'),
    body('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a positive number'),
    body('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a positive number'),
  ],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    try {
      const savedSearch = await savedSearchesService.createSavedSearch(
        req.session.userId,
        req.body
      );
      res.status(201).json({ message: 'Search saved successfully', savedSearch });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: err.message });
      }

      console.error('POST /api/saved-searches error:', err);
      return res.status(500).json({ message: err.message || 'Failed to save search' });
    }
  }
);

// GET /api/saved-searches - List all saved searches for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const searches = await savedSearchesService.listSavedSearchesForUser(req.session.userId);
    res.json({ searches });
  } catch (err) {
    console.error('GET /api/saved-searches error:', err);
    res.status(500).json({ message: 'Failed to load saved searches' });
  }
});

// PUT /api/saved-searches/:searchId - Update a saved search
router.put(
  '/:searchId',
  requireAuth,
  [
    param('searchId').isInt().withMessage('searchId must be a valid integer'),
    body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 255 }).withMessage('name must be at most 255 characters'),
    body('query').trim().notEmpty().withMessage('query is required').isLength({ max: 500 }).withMessage('query must be at most 500 characters'),
    body('location').optional().trim().isLength({ max: 255 }).withMessage('location must be at most 255 characters'),
    body('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a positive number'),
    body('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a positive number'),
  ],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    try {
      const updated = await savedSearchesService.updateSavedSearch(
        req.session.userId,
        req.params.searchId,
        req.body
      );

      if (!updated) {
        return res.status(404).json({ message: 'Saved search not found' });
      }

      return res.json({ message: 'Search updated successfully' });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: err.message });
      }

      console.error('PUT /api/saved-searches/:searchId error:', err);
      return res.status(500).json({ message: err.message || 'Failed to update search' });
    }
  }
);

// DELETE /api/saved-searches/:searchId - Delete a saved search
router.delete(
  '/:searchId',
  requireAuth,
  [param('searchId').isInt().withMessage('searchId must be a valid integer')],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    try {
      const deleted = await savedSearchesService.deleteSavedSearch(
        req.session.userId,
        req.params.searchId
      );

      if (!deleted) {
        return res.status(404).json({ message: 'Saved search not found' });
      }

      return res.json({ message: 'Saved search removed' });
    } catch (err) {
      console.error('DELETE /api/saved-searches/:searchId error:', err);
      return res.status(500).json({ message: 'Failed to remove saved search' });
    }
  }
);

module.exports = router;

const express = require('express');
const { body, param, validationResult } = require('express-validator');

const { requireAuth } = require('./auth');
const { SavedItemsService, normalizeSavedItemInput } = require('../services/savedItemsService');

const router = express.Router();
const savedItemsService = new SavedItemsService();

function validate(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }

  return res.status(422).json({ errors: errors.array() });
}

router.post(
  '/',
  requireAuth,
  [
    body('externalItemId').trim().notEmpty().withMessage('externalItemId is required'),
    body('title').trim().notEmpty().withMessage('title is required'),
    body('url').trim().isURL().withMessage('url must be a valid URL'),
    body('source').trim().notEmpty().withMessage('source is required'),
  ],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    const normalized = normalizeSavedItemInput(req.body);

    try {
      const savedItem = await savedItemsService.saveItemForUser(req.session.userId, normalized);
      res.status(201).json({ message: 'Item saved successfully', savedItem });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Item already saved' });
      }

      console.error('POST /api/saved-items error:', err);
      return res.status(500).json({ message: 'Failed to save item' });
    }
  }
);

router.get('/', requireAuth, async (req, res) => {
  try {
    const items = await savedItemsService.listSavedItemsForUser(req.session.userId);
    res.json({ items });
  } catch (err) {
    console.error('GET /api/saved-items error:', err);
    res.status(500).json({ message: 'Failed to load saved items' });
  }
});

router.delete(
  '/:externalItemId',
  requireAuth,
  [param('externalItemId').trim().notEmpty().withMessage('externalItemId is required')],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    try {
      const deleted = await savedItemsService.deleteSavedItemForUser(
        req.session.userId,
        req.params.externalItemId
      );

      if (!deleted) {
        return res.status(404).json({ message: 'Saved item not found' });
      }

      return res.json({ message: 'Saved item removed' });
    } catch (err) {
      console.error('DELETE /api/saved-items/:externalItemId error:', err);
      return res.status(500).json({ message: 'Failed to remove saved item' });
    }
  }
);

module.exports = router;

const express = require('express');
const { body, validationResult } = require('express-validator');

const { requireAuth } = require('./auth');
const { ChatbotService } = require('../services/chatbotService');

const router = express.Router();
const chatbotService = new ChatbotService();

function validate(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }

  return res.status(422).json({ errors: errors.array() });
}

// POST /api/chatbot/process-message - Process user message and extract search parameters
router.post(
  '/process-message',
  requireAuth,
  [
    body('message')
      .trim()
      .notEmpty()
      .withMessage('message is required')
      .isLength({ max: 500 })
      .withMessage('message must be at most 500 characters'),
  ],
  async (req, res) => {
    if (validate(req, res)) {
      return;
    }

    try {
      const result = await chatbotService.processUserMessage(
        req.session.userId,
        req.body.message
      );

      if (!result.success) {
        return res.status(503).json({
          message: result.message,
          error: result.error,
        });
      }

      return res.json({
        message: result.message,
        searchParams: result.searchParams,
        confidence: result.confidence,
      });
    } catch (err) {
      console.error('POST /api/chatbot/process-message error:', err);
      return res.status(500).json({
        message: 'Failed to process message',
        error: err.message,
      });
    }
  }
);

module.exports = router;

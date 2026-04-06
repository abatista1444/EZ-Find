const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Craigslist site ID mappings for common locations
const LOCATION_MAPPING = {
  'san francisco': 'sfbay',
  'sf': 'sfbay',
  'bay area': 'sfbay',
  'berkeley': 'sfbay',
  'oakland': 'sfbay',
  'los angeles': 'la',
  'la': 'la',
  'lax': 'la',
  'new york': 'newyork',
  'ny': 'newyork',
  'nyc': 'newyork',
  'seattle': 'seattle',
  'chicago': 'chicago',
  'denver': 'denver',
  'austin': 'austin',
  'boston': 'boston',
  'washington': 'dc',
  'dc': 'dc',
  'miami': 'miami',
  'portland': 'portland',
};

class ChatbotService {
  constructor(database = db) {
    this.db = database;
  }

  /**
   * Fetch user's recent saved searches for context
   */
  async getUserSavedSearches(userId, limit = 5) {
    try {
      const [rows] = await this.db.query(
        `SELECT Name, Query, Location FROM SavedSearches
         WHERE userId = ?
         ORDER BY CreatedAt DESC
         LIMIT ?`,
        [userId, limit]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching saved searches:', error);
      return [];
    }
  }

  /**
   * Fetch user's recent saved items for context
   */
  async getUserSavedItems(userId, limit = 5) {
    try {
      const [rows] = await this.db.query(
        `SELECT ItemName, Price, Source, Location FROM SavedItems
         WHERE userId = ?
         ORDER BY DateSaved DESC
         LIMIT ?`,
        [userId, limit]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching saved items:', error);
      return [];
    }
  }

  /**
   * Build a system prompt with user context
   */
  buildSystemPrompt(userContext) {
    let prompt = `You are a helpful marketplace search assistant for a Craigslist search aggregator.
The user is looking for items on Craigslist.

`;

    if (userContext.savedSearches && userContext.savedSearches.length > 0) {
      prompt += 'The user has previously searched for:\n';
      userContext.savedSearches.forEach(search => {
        prompt += `- ${search.Query}${search.Location ? ` in ${search.Location}` : ''}\n`;
      });
      prompt += '\n';
    }

    if (userContext.savedItems && userContext.savedItems.length > 0) {
      prompt += 'The user has saved these types of items:\n';
      userContext.savedItems.forEach(item => {
        prompt += `- ${item.ItemName}${item.Price ? ` ($${item.Price})` : ''}${item.Location ? ` in ${item.Location}` : ''}\n`;
      });
      prompt += '\n';
    }

    prompt += `Based on the user's new request, extract the following search parameters as JSON:
{
  "query": "...", (the main search term for the item they're looking for)
  "location": "...", (Craigslist site code, e.g., sfbay, la, newyork, or null if not specified)
  "minPrice": null or number, (minimum price if mentioned)
  "maxPrice": null or number, (maximum price if mentioned)
  "acknowledgment": "..." (a friendly 1-2 sentence acknowledgment of what they're looking for)
}

IMPORTANT: Return ONLY valid JSON, no extra text. If you cannot determine a value, use null.
Locations should be lowercase site codes (sfbay, la, newyork, etc), not full names.`;

    return prompt;
  }

  /**
   * Normalize location string to Craigslist site code
   */
  normalizeLocation(locationStr) {
    if (!locationStr) return null;
    const normalized = locationStr.toLowerCase().trim();

    // Direct match
    if (LOCATION_MAPPING[normalized]) {
      return LOCATION_MAPPING[normalized];
    }

    // Partial match
    for (const [key, value] of Object.entries(LOCATION_MAPPING)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Parse Claude's response and extract structured search parameters
   */
  parseResponse(responseText) {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not find JSON in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        query: parsed.query || '',
        location: parsed.location ? this.normalizeLocation(parsed.location) : null,
        minPrice: Number.isFinite(parsed.minPrice) ? Math.max(0, parsed.minPrice) : null,
        maxPrice: Number.isFinite(parsed.maxPrice) ? Math.max(0, parsed.maxPrice) : null,
        acknowledgment: parsed.acknowledgment || 'Got it! Searching for your items...',
        confidence: 0.95,
      };
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      return null;
    }
  }

  /**
   * Process user message and extract search parameters
   */
  async processUserMessage(userId, userMessage) {
    try {
      // Validate input
      if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
        throw new Error('Message is required');
      }

      // Get user context
      const [savedSearches, savedItems] = await Promise.all([
        this.getUserSavedSearches(userId),
        this.getUserSavedItems(userId),
      ]);

      const systemPrompt = this.buildSystemPrompt({
        savedSearches,
        savedItems,
      });

      // Call Claude API
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage.trim(),
          },
        ],
      });

      // Extract text from response
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

      // Parse the response
      const parsed = this.parseResponse(responseText);

      if (!parsed) {
        throw new Error('Failed to extract search parameters from response');
      }

      return {
        success: true,
        message: parsed.acknowledgment,
        searchParams: {
          query: parsed.query,
          location: parsed.location,
          minPrice: parsed.minPrice,
          maxPrice: parsed.maxPrice,
        },
        confidence: parsed.confidence,
      };
    } catch (error) {
      console.error('Chatbot service error:', error);

      // Return error response
      return {
        success: false,
        message: error.message || 'Failed to process message. Please try again.',
        error: error.message,
      };
    }
  }
}

module.exports = {
  ChatbotService,
};

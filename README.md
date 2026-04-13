# EZFind – Unified Marketplace

## Search API

The backend exposes a unified search endpoint that currently queries Craigslist
(and can be extended with additional connectors).

### Configuration

Craigslist connector settings are loaded from environment variables.
- `CRAIGSLIST_DEFAULT_SITE` — Default Craigslist site/subdomain (for example `sfbay`) used
  when no location is provided.
- `CRAIGSLIST_PROVIDER_BASE_URL` — Optional third-party provider/proxy base URL. If set,
  EZFind will try the provider first and then fall back to Craigslist RSS.
- `CRAIGSLIST_PROVIDER_API_KEY` — Optional key for the provider endpoint.

Craigslist does not provide an official public listing API. EZFind therefore uses an
RSS-first integration (`format=rss`) and automatically falls back to an internal
HTML scraper strategy when RSS is blocked (for example HTTP 403). This mode does not
require a third-party provider or API key.

In other words, the system works out-of-the-box without any API keys; credentials only
unlock optional provider endpoints and may improve reliability or rate-limits.

Add entries to `backend/.env` or supply via deployment configuration. The service is
already resilient enough that the absence of keys does not prevent building or testing.

Example request:

```
GET /api/search?q=bicycle&location=Seattle
```

The JSON response contains a `listings` array of normalized items and an `errors` array
with any marketplace-specific failures. Clients should show partial results if errors are
present.

You can run the automated test suite (unit + integration) with Jest:

```bash
cd backend
npm install       # first time only
npm test          # runs jest
```

The old manual script was removed in favor of proper tests.

---

## Features

- **🔍 Unified Marketplace Search** — Search Craigslist listings from a single interface
- **📌 Save Items & Searches** — Bookmark listings and save search queries for future reference
- **🔗 Share Search Results** — Generate shareable tokens for public search links without login
- **💬 AI Chatbot** — Natural language search assistant powered by Claude API
- **👤 User Accounts** — Secure authentication with bcrypt password hashing
- **🔐 Session Management** — Server-side sessions with httpOnly cookies

---

## Tech Stack

| Layer    | Technology                         |
|----------|------------------------------------|
| Frontend | React 18, React Router 6           |
| Backend  | Node.js 18+, Express 4             |
| Database | MySQL 8+                           |
| Sessions | express-session (server-side)      |
| Auth     | bcryptjs (password hashing)        |
| AI       | Claude API (natural language search) |

---

## Prerequisites

| Tool      | Minimum version | Install                          |
|-----------|-----------------|----------------------------------|
| Node.js   | 18.x            | https://nodejs.org               |
| npm       | 9.x             | bundled with Node                |
| MySQL     | 8.0             | https://dev.mysql.com/downloads/ |

---

## Quick Start

### 1. Clone & enter the repo

```bash
git clone <repo-url> ezfind
cd ezfind
```

### 2. Run the build script

```bash
chmod +x build.sh
./build.sh
```

This will:
- Check prerequisites
- Copy `.env.example` → `backend/.env`
- Install all npm dependencies (root, backend, frontend)
- Initialize the MySQL database schema

### 3. Configure environment

Open `backend/.env` and fill in your values:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ezfind

SESSION_SECRET=change_this_to_a_long_random_string
SESSION_MAX_AGE=86400000

# Optional: Claude API key for AI chatbot (get free key at https://console.anthropic.com/)
CLAUDE_API_KEY=sk-...
```

> **Important:** `SESSION_SECRET` must be changed to a long random string in any real environment.

### 4. Start development servers

```bash
npm run dev
```

This runs **both** servers concurrently:
- Backend → http://localhost:5000
- Frontend → http://localhost:3000

Or start them separately:

```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

### 5. Open the app

Navigate to **http://localhost:3000** in your browser.

---

## Usage Guide

### Searching for Listings

1. Enter a search term and location on the dashboard
2. Click **"Search Craigslist"** to browse results
3. Use the **AI Chatbot** (right sidebar) for natural language queries like:
   - "Show me road bikes under $300 in Seattle"
   - "I'm looking for used furniture in San Francisco"
4. Click **"Save Search"** to keep the query for later

### Saving Items and Searches

- **Saved Items**: Click the save icon on any listing to bookmark it
- **Saved Searches**: Click the "Save Search" button after searching
- Visit **"Saved Items"** or **"Saved Searches"** pages to manage your collection
- Edit or delete saved items and searches anytime

### Sharing Search Results

1. Perform a search
2. Click **"Share Search"** button
3. (Optional) Set an expiration date
4. Copy the generated URL and share with others
5. Recipients can view results without creating an account

### Using the AI Chatbot

1. Open the **ChatBot** sidebar on the dashboard (right side)
2. Describe what you're looking for in natural language
3. The AI extracts search parameters and suggests refinements
4. Click the search button to execute the query
5. Collapse the sidebar anytime by clicking the toggle

---

## Database Initialization (manual)

If the build script skipped the DB step, run:

```bash
mysql -u root -p < scripts/init_db.sql
```

---

## Production Build

```bash
./build.sh --prod
```

This creates an optimized React bundle in `frontend/build/`. You can then serve it statically or configure Express to serve it.

To serve the React build from Express, add this to `backend/server.js`:

```js
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'))
);
```

Then run:

```bash
npm start    # starts only the Express server on port 5000
```

---

## API Reference

| Method | Endpoint                        | Auth required | Description                              |
|--------|---------------------------------|---------------|------------------------------------------|
| GET    | `/api/health`                   | No            | Health check                             |
| POST   | `/api/auth/register`            | No (guest)    | Create new account and start session     |
| POST   | `/api/auth/login`               | No (guest)    | Sign in and regenerate session           |
| POST   | `/api/auth/logout`              | Yes           | Sign out (destroys session)              |
| GET    | `/api/auth/me`                  | Yes           | Get current user profile                 |
| GET    | `/api/search`                   | No            | Search normalized marketplace listings   |
| GET    | `/api/saved-items`              | Yes           | List the current user's saved items       |
| POST   | `/api/saved-items`              | Yes           | Save a listing for the current user      |
| DELETE | `/api/saved-items/:externalItemId` | Yes        | Remove a saved listing by external ID    |
| GET    | `/api/saved-searches`           | Yes           | List the current user's saved searches    |
| POST   | `/api/saved-searches`           | Yes           | Save a search query for the current user |
| DELETE | `/api/saved-searches/:id`       | Yes           | Delete a saved search by ID              |
| POST   | `/api/shared-searches`          | Yes           | Create a shareable token for a search    |
| GET    | `/api/shared-searches/:token`   | No            | Get shared search metadata by token      |
| GET    | `/api/shared-searches/user/my-shares` | Yes    | List the current user's shared searches  |
| POST   | `/api/chatbot/process-message`  | Yes           | Process natural language search request  |

### POST /api/auth/register

```json
{
  "email": "user@example.com",
  "password": "SecurePass1",
  "firstName": "Jane",
  "lastName": "Doe",
  "address": "123 Main St",
  "city": "Dallas",
  "state": "TX",
  "country": "US"
}
```

Password requirements: 8+ characters, 1 uppercase letter, 1 number.

### GET /api/search

Query parameters:
- `q` (required): search keyword(s)
- `location` (optional): location/site hint
- `minPrice` (optional): minimum price number
- `maxPrice` (optional): maximum price number

Example request:

```http
GET /api/search?q=bicycle&location=Seattle&minPrice=100&maxPrice=1000
```

Example response:

```json
{
  "listings": [
    {
      "id": "cl-123",
      "title": "Road Bike",
      "price": 450,
      "url": "https://...",
      "source": "craigslist"
    }
  ],
  "errors": []
}
```

Returns `400` when `q` is missing.

### GET /api/saved-items

Requires an authenticated session cookie.

Example response:

```json
{
  "items": [
    {
      "externalItemId": "cl-123",
      "title": "Road Bike",
      "url": "https://...",
      "source": "craigslist"
    }
  ]
}
```

### POST /api/saved-items

Requires an authenticated session cookie.

Example request:

```json
{
  "externalItemId": "cl-123",
  "title": "Road Bike",
  "url": "https://example.com/listing/123",
  "source": "craigslist",
  "price": 450,
  "location": "Seattle"
}
```

Returns:
- `201` when saved
- `409` if the item is already saved
- `422` for validation errors

### DELETE /api/saved-items/:externalItemId

Requires an authenticated session cookie.

Returns:
- `200` when removed
- `404` if the item was not found
- `422` for validation errors

### POST /api/shared-searches

Creates a shareable token for a search result. Requires an authenticated session cookie.

Request:

```json
{
  "query": "bicycle",
  "location": "Seattle",
  "minPrice": 100,
  "maxPrice": 1000,
  "expiresInDays": 7
}
```

Response:

```json
{
  "token": "a1b2c3d4e5f6...",
  "shareUrl": "http://localhost:3000/search/a1b2c3d4e5f6...",
  "expiresAt": "2026-04-20T12:00:00Z"
}
```

Returns:
- `201` when created
- `422` for validation errors

### GET /api/shared-searches/:token

Retrieves metadata for a shared search without requiring authentication.

Response:

```json
{
  "query": "bicycle",
  "location": "Seattle",
  "minPrice": 100,
  "maxPrice": 1000,
  "createdAt": "2026-04-13T12:00:00Z",
  "accessCount": 5
}
```

Returns:
- `200` when found
- `404` if token is expired or not found

### POST /api/chatbot/process-message

Processes natural language input to extract search parameters using Claude AI. Requires an authenticated session cookie.

Request:

```json
{
  "message": "I'm looking for a mountain bike under $500 in San Francisco"
}
```

Response:

```json
{
  "message": "Found a great match! I'm searching for mountain bikes up to $500 in San Francisco.",
  "searchParams": {
    "query": "mountain bike",
    "location": "sfbay",
    "minPrice": null,
    "maxPrice": 500
  },
  "confidence": 0.92
}
```

Returns:
- `200` with extracted parameters
- `400` if message is empty
- `422` for processing errors

---

## Project Structure

```
ezfind/
├── build.sh                      # Build/setup script
├── node_install.sh               # Node install helper script
├── EZfind_tables.sql             # SQL schema/reference dump
├── package.json                  # Root scripts (setup, dev, build)
├── scripts/
│   ├── init_db.sql               # DB initialization script
│   ├── migrate_saved_items.sql   # Saved-items migration script
│   └── rollback_migrate_saved_items.sql
├── backend/
│   ├── server.js                 # Express app entry point
│   ├── db.js                     # MySQL connection pool
│   ├── .env.example              # Environment variable template
│   ├── package.json
│   ├── services/
│   │   ├── ListingAggregator.js  # Multi-source aggregation logic
│   │   ├── listingTypes.js       # Shared listing normalization types
│   │   ├── savedItemsService.js
│   │   ├── savedSearchesService.js
│   │   ├── sharedSearchService.js
│   │   ├── chatbotService.js     # Claude AI integration
│   │   └── marketplaces/
│   │       ├── craigslistConnector.js
│   │       └── craigslistSources/
│   │           ├── ProviderCraigslistSource.js
│   │           ├── RssCraigslistSource.js
│   │           └── ScrapeCraigslistSource.js
│   ├── routes/
│   │   ├── auth.js               # Register / login / logout / me
│   │   ├── search.js             # Unified listing search endpoint
│   │   ├── savedItems.js         # Saved listings CRUD endpoints
│   │   ├── savedSearches.js      # Saved searches CRUD endpoints
│   │   ├── sharedSearches.js     # Shared search token endpoints
│   │   └── chatbot.js            # AI chatbot endpoint
│   └── test/
│       ├── aggregator.test.js
│       ├── craigslistConnector.test.js
│       ├── rssCraigslistSource.test.js
│       ├── savedItems.test.js
│       ├── scrapeCraigslistSource.test.js
│       └── searchRoute.test.js
└── frontend/
  ├── package.json
  ├── public/
  │   └── index.html
  └── src/
    ├── App.js                # Router setup
    ├── index.js
    ├── api/
    │   ├── savedItemsApi.js
    │   ├── savedSearchesApi.js
    │   ├── sharedSearchesApi.js
    │   └── chatbotApi.js
    ├── context/
    │   └── AuthContext.js
    ├── components/
    │   ├── ProtectedRoute.js
    │   ├── MarketplaceSearch.js
    │   ├── ShareSearchModal.js
    │   └── ChatbotSidebar.js
    └── pages/
      ├── SearchPage.js
      ├── SavedItemsPage.js
      ├── SavedSearchesPage.js
      ├── SharedSearchPage.js
      ├── LoginPage.js
      ├── RegisterPage.js
      ├── DashboardPage.js
      ├── Auth.css
      ├── Dashboard.css
      ├── Search.css
      ├── SavedItems.css
      ├── SavedSearches.css
      ├── SharedSearch.css
      └── ChatbotSidebar.css
```

---

## Security Notes

- Passwords are hashed with **bcrypt** (cost factor 12) — never stored plain.
- Sessions are **server-side** (no sensitive data in the browser cookie).
- Cookie is **`httpOnly`** (not accessible from JavaScript).
- Cookie is **`secure`** in production (HTTPS only).
- Session is **regenerated** on login to prevent session-fixation attacks.
- Generic error messages on login prevent user enumeration.

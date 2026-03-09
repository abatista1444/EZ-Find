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


> Browse Craigslist listings in one place.

## Tech Stack

| Layer    | Technology                         |
|----------|------------------------------------|
| Frontend | React 18, React Router 6           |
| Backend  | Node.js 18+, Express 4             |
| Database | MySQL 8+                           |
| Sessions | express-session (server-side)      |
| Auth     | bcryptjs (password hashing)        |

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

| Method | Endpoint           | Auth required | Description                     |
|--------|--------------------|---------------|---------------------------------|
| GET    | `/api/health`      | No            | Health check                    |
| POST   | `/api/auth/register` | No (guest)  | Create new account              |
| POST   | `/api/auth/login`  | No (guest)    | Sign in                         |
| POST   | `/api/auth/logout` | Yes           | Sign out (destroys session)     |
| GET    | `/api/auth/me`     | Yes           | Get current user profile        |

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

---

## Project Structure

```
ezfind/
├── build.sh                  # Build & setup script
├── package.json              # Root scripts (dev, build, setup)
├── scripts/
│   └── init_db.sql           # Database schema
├── backend/
│   ├── server.js             # Express app entry point
│   ├── db.js                 # MySQL connection pool
│   ├── .env.example          # Environment variable template
│   ├── package.json
│   └── routes/
│       └── auth.js           # Register / Login / Logout / Me
└── frontend/
    ├── package.json
    └── src/
        ├── App.js            # Router setup
        ├── index.js
        ├── context/
        │   └── AuthContext.js    # Global auth state + API calls
        ├── components/
        │   └── ProtectedRoute.js # Guards authenticated routes
        └── pages/
            ├── LoginPage.js
            ├── RegisterPage.js
            ├── DashboardPage.js
            ├── Auth.css
            └── Dashboard.css
```

---

## Security Notes

- Passwords are hashed with **bcrypt** (cost factor 12) — never stored plain.
- Sessions are **server-side** (no sensitive data in the browser cookie).
- Cookie is **`httpOnly`** (not accessible from JavaScript).
- Cookie is **`secure`** in production (HTTPS only).
- Session is **regenerated** on login to prevent session-fixation attacks.
- Generic error messages on login prevent user enumeration.

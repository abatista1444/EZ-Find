#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# EZFind Build Script
# Usage: ./build.sh [--prod]
#   --prod   Also runs `npm run build` to create a production React bundle
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROD=false
for arg in "$@"; do
  [[ "$arg" == "--prod" ]] && PROD=true
done

echo "╔══════════════════════════════════════════╗"
echo "║         EZFind Build Script              ║"
echo "╚══════════════════════════════════════════╝"

# ── 1. Check prerequisites ────────────────────────────────────────────────────
echo ""
echo "▶ Checking prerequisites…"

command -v node  >/dev/null 2>&1 || { echo "❌  Node.js not found. Install from https://nodejs.org"; exit 1; }
command -v npm   >/dev/null 2>&1 || { echo "❌  npm not found.";   exit 1; }
command -v mysql >/dev/null 2>&1 || echo "⚠️   mysql CLI not found – skipping DB init (run manually)"

NODE_VER=$(node -v | sed 's/v//')
MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [[ "$MAJOR" -lt 16 ]]; then
  echo "❌  Node.js >= 16 required (found $NODE_VER)"; exit 1
fi
echo "   Node.js $NODE_VER ✓"

# ── 2. Copy .env if missing ───────────────────────────────────────────────────
echo ""
echo "▶ Checking environment configuration…"
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "   Created backend/.env from .env.example"
  echo "   ⚠️   Edit backend/.env and set DB_PASSWORD and SESSION_SECRET before running!"
else
  echo "   backend/.env already exists ✓"
fi

# ── 3. Install dependencies ───────────────────────────────────────────────────
echo ""
echo "▶ Installing backend dependencies…"
(cd backend && npm install)
echo "   Backend packages installed ✓"

echo ""
echo "▶ Installing frontend dependencies…"
(cd frontend && npm install)
echo "   Frontend packages installed ✓"

echo ""
echo "▶ Installing root dev dependencies…"
npm install
echo "   Root packages installed ✓"

# ── 4. Initialize database (optional) ────────────────────────────────────────
echo ""
if command -v mysql >/dev/null 2>&1; then
  # Load .env values for DB credentials
  if [[ -f backend/.env ]]; then
    export $(grep -v '^#' backend/.env | xargs) 2>/dev/null || true
  fi
  DB_USER="${DB_USER:-root}"
  DB_NAME="${DB_NAME:-ezfind}"

  echo "▶ Initializing MySQL database '${DB_NAME}'…"
  echo "   (You may be prompted for your MySQL root password)"
  mysql -u "$DB_USER" -p"${DB_PASSWORD:-}" < scripts/init_db.sql \
    && echo "   Database initialized ✓" \
    || echo "   ⚠️   DB init failed – run manually: mysql -u $DB_USER -p < scripts/init_db.sql"
else
  echo "▶ Skipping DB init (mysql CLI not found)."
  echo "   Run manually: mysql -u <user> -p < scripts/init_db.sql"
fi

# ── 5. Production build ───────────────────────────────────────────────────────
if $PROD; then
  echo ""
  echo "▶ Building React production bundle…"
  (cd frontend && npm run build)
  echo "   Production build complete → frontend/build/ ✓"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅  Build complete!                                         ║"
echo "║                                                              ║"
echo "║  Next steps:                                                 ║"
echo "║  1. Edit backend/.env (set DB_PASSWORD, SESSION_SECRET)      ║"
echo "║  2. Start both servers:                                      ║"
echo "║       npm run dev          (from project root)               ║"
echo "║  — or separately —                                           ║"
echo "║       npm run dev:backend  (port 5000)                       ║"
echo "║       npm run dev:frontend (port 3000)                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"

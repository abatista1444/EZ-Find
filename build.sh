#!/usr/bin/env bash
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# EZFind Build Script
# Usage: ./build.sh [--prod] [--db-migrate] [--db-rollback]
#   --prod         Also runs `npm run build` to create a production React bundle
#   --db-migrate   Runs scripts/migrate_saved_items.sql after init_db.sql
#   --db-rollback  Runs scripts/rollback_migrate_saved_items.sql (instead of migrate)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

set -euo pipefail

PROD=false
DB_MIGRATE=false
DB_ROLLBACK=false
for arg in "$@"; do
  [[ "$arg" == "--prod" ]] && PROD=true
  [[ "$arg" == "--db-migrate" ]] && DB_MIGRATE=true
  [[ "$arg" == "--db-rollback" ]] && DB_ROLLBACK=true
done

if $DB_MIGRATE && $DB_ROLLBACK; then
  echo "âŒ  Use either --db-migrate or --db-rollback, not both."; exit 1
fi

echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘         EZFind Build Script              â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"

# â”€â”€ 1. Check prerequisites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo ""
echo "â–¶ Checking prerequisitesâ€¦"

command -v node  >/dev/null 2>&1 || { echo "âŒ  Node.js not found. Install from https://nodejs.org"; exit 1; }
command -v npm   >/dev/null 2>&1 || { echo "âŒ  npm not found.";   exit 1; }
command -v mysql >/dev/null 2>&1 || echo "âš ï¸   mysql CLI not found â€“ skipping DB init (run manually)"

NODE_VER=$(node -v | sed 's/v//')
MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [[ "$MAJOR" -lt 16 ]]; then
  echo "âŒ  Node.js >= 16 required (found $NODE_VER)"; exit 1
fi
echo "   Node.js $NODE_VER âœ“"

# â”€â”€ 2. Copy .env if missing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo ""
echo "â–¶ Checking environment configurationâ€¦"
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "   Created backend/.env from .env.example"
  echo "   âš ï¸   Edit backend/.env and set DB_PASSWORD and SESSION_SECRET before running!"
else
  echo "   backend/.env already exists âœ“"
fi

# â”€â”€ 3. Install dependencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo ""
echo "â–¶ Installing backend dependenciesâ€¦"
(cd backend && npm install)
echo "   Backend packages installed âœ“"

echo ""
echo "â–¶ Installing frontend dependenciesâ€¦"
(cd frontend && npm install)
echo "   Frontend packages installed âœ“"

echo ""
echo "â–¶ Installing root dev dependenciesâ€¦"
npm install
echo "   Root packages installed âœ“"

# â”€â”€ 4. Initialize database and optional migrations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo ""
if command -v mysql >/dev/null 2>&1; then
  # Load .env values for DB credentials
  if [[ -f backend/.env ]]; then
    export $(grep -v '^#' backend/.env | xargs) 2>/dev/null || true
  fi
  DB_USER="${DB_USER:-root}"
  DB_NAME="${DB_NAME:-ezfind}"

  echo "â–¶ Initializing MySQL database '${DB_NAME}'â€¦"
  echo "   (You may be prompted for your MySQL root password)"
  if mysql -u "$DB_USER" -p"${DB_PASSWORD:-}" < scripts/init_db.sql; then
    echo "   Database initialized âœ“"

    if $DB_ROLLBACK; then
      echo "â–¶ Running SavedItems rollback migrationâ€¦"
      mysql -u "$DB_USER" -p"${DB_PASSWORD:-}" < scripts/rollback_migrate_saved_items.sql \
        && echo "   SavedItems rollback complete âœ“" \
        || echo "   âš ï¸   SavedItems rollback failed â€“ run manually: mysql -u $DB_USER -p < scripts/rollback_migrate_saved_items.sql"
    elif $DB_MIGRATE; then
      echo "â–¶ Running SavedItems migrationâ€¦"
      mysql -u "$DB_USER" -p"${DB_PASSWORD:-}" < scripts/migrate_saved_items.sql \
        && echo "   SavedItems migration complete âœ“" \
        || echo "   âš ï¸   SavedItems migration failed â€“ run manually: mysql -u $DB_USER -p < scripts/migrate_saved_items.sql"
    else
      echo "â–¶ Skipping SavedItems migration (pass --db-migrate to run it)."
    fi
  else
    echo "   âš ï¸   DB init failed â€“ run manually: mysql -u $DB_USER -p < scripts/init_db.sql"
  fi
else
  echo "â–¶ Skipping DB init (mysql CLI not found)."
  echo "   Run manually: mysql -u <user> -p < scripts/init_db.sql"
fi

# â”€â”€ 5. Production build â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if $PROD; then
  echo ""
  echo "â–¶ Building React production bundleâ€¦"
  (cd frontend && npm run build)
  echo "   Production build complete â†’ frontend/build/ âœ“"
fi

# â”€â”€ Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo ""
echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘  âœ…  Build complete!                                         â•‘"
echo "â•‘                                                              â•‘"
echo "â•‘  Next steps:                                                 â•‘"
echo "â•‘  1. Edit backend/.env (set DB_PASSWORD, SESSION_SECRET)      â•‘"
echo "â•‘  2. Start both servers:                                      â•‘"
echo "â•‘       npm run dev          (from project root)               â•‘"
echo "â•‘  â€” or separately â€”                                           â•‘"
echo "â•‘       npm run dev:backend  (port 5000)                       â•‘"
echo "â•‘       npm run dev:frontend (port 3000)                       â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"

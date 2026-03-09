-- SavedItems migration for existing EZFind databases
-- Purpose:
-- 1) Ensure SavedItems has the snapshot columns used by the app
-- 2) Backfill legacy rows so NOT NULL constraints can be enforced safely
-- 3) Remove duplicate rows per (UserId, ExternalItemId)
-- 4) Add unique index and foreign key if missing
--
-- Usage:
--   mysql -u <user> -p < scripts/migrate_saved_items.sql

USE ezfind;

-- Create table if it does not exist yet.
CREATE TABLE IF NOT EXISTS SavedItems (
  ItemId          INT AUTO_INCREMENT PRIMARY KEY,
  UserId          INT NOT NULL,
  ExternalItemId  VARCHAR(255) NOT NULL,
  ItemName        VARCHAR(255) NOT NULL,
  ItemDescription TEXT,
  Price           DECIMAL(10, 2),
  Url             TEXT NOT NULL,
  Source          VARCHAR(100) NOT NULL,
  ImageUrl        TEXT,
  Location        VARCHAR(255),
  PostedAt        DATETIME,
  DateSaved       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns for legacy deployments.
-- Uses INFORMATION_SCHEMA checks for compatibility with MySQL versions that
-- do not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'ItemId'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN ItemId INT NULL',
  'SELECT "ItemId already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'ExternalItemId'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN ExternalItemId VARCHAR(255)',
  'SELECT "ExternalItemId already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'ItemName'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN ItemName VARCHAR(255)',
  'SELECT "ItemName already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'ItemDescription'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN ItemDescription TEXT',
  'SELECT "ItemDescription already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'Price'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN Price DECIMAL(10, 2)',
  'SELECT "Price already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'Url'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN Url TEXT',
  'SELECT "Url already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'Source'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN Source VARCHAR(100)',
  'SELECT "Source already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'ImageUrl'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN ImageUrl TEXT',
  'SELECT "ImageUrl already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'Location'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN Location VARCHAR(255)',
  'SELECT "Location already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'PostedAt'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN PostedAt DATETIME',
  'SELECT "PostedAt already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'DateSaved'
);
SET @sql_col := IF(@col_exists = 0,
  'ALTER TABLE SavedItems ADD COLUMN DateSaved DATETIME DEFAULT CURRENT_TIMESTAMP',
  'SELECT "DateSaved already exists"');
PREPARE stmt_col FROM @sql_col; EXECUTE stmt_col; DEALLOCATE PREPARE stmt_col;

-- Backfill required values before enforcing NOT NULL.
UPDATE SavedItems
SET
  ExternalItemId = COALESCE(NULLIF(TRIM(ExternalItemId), ''), CONCAT('legacy-', UUID())),
  ItemName = COALESCE(NULLIF(TRIM(ItemName), ''), 'Untitled Item'),
  Url = COALESCE(NULLIF(TRIM(Url), ''), '#'),
  Source = COALESCE(NULLIF(TRIM(Source), ''), 'legacy'),
  DateSaved = COALESCE(DateSaved, CURRENT_TIMESTAMP);

-- Remove duplicates to allow a unique key on (UserId, ExternalItemId).
-- Uses a temporary table so this works even when legacy schemas have no ItemId.
CREATE TEMPORARY TABLE tmp_saved_items_dedup AS
SELECT
  UserId,
  ExternalItemId,
  MAX(ItemName) AS ItemName,
  MAX(ItemDescription) AS ItemDescription,
  MAX(Price) AS Price,
  MAX(Url) AS Url,
  MAX(Source) AS Source,
  MAX(ImageUrl) AS ImageUrl,
  MAX(Location) AS Location,
  MAX(PostedAt) AS PostedAt,
  MIN(DateSaved) AS DateSaved
FROM SavedItems
GROUP BY UserId, ExternalItemId;

DELETE FROM SavedItems;

INSERT INTO SavedItems (
  UserId,
  ExternalItemId,
  ItemName,
  ItemDescription,
  Price,
  Url,
  Source,
  ImageUrl,
  Location,
  PostedAt,
  DateSaved
)
SELECT
  UserId,
  ExternalItemId,
  ItemName,
  ItemDescription,
  Price,
  Url,
  Source,
  ImageUrl,
  Location,
  PostedAt,
  DateSaved
FROM tmp_saved_items_dedup;

DROP TEMPORARY TABLE tmp_saved_items_dedup;

-- Enforce expected column definitions.
ALTER TABLE SavedItems
  MODIFY COLUMN UserId INT NOT NULL,
  MODIFY COLUMN ExternalItemId VARCHAR(255) NOT NULL,
  MODIFY COLUMN ItemName VARCHAR(255) NOT NULL,
  MODIFY COLUMN Url TEXT NOT NULL,
  MODIFY COLUMN Source VARCHAR(100) NOT NULL,
  MODIFY COLUMN DateSaved DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Add unique key if it does not already exist.
SET @saved_items_unique_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND INDEX_NAME = 'uq_saved_items_user_external'
);

SET @sql_unique := IF(
  @saved_items_unique_exists = 0,
  'ALTER TABLE SavedItems ADD UNIQUE KEY uq_saved_items_user_external (UserId, ExternalItemId)',
  'SELECT "uq_saved_items_user_external already exists"'
);

PREPARE stmt_unique FROM @sql_unique;
EXECUTE stmt_unique;
DEALLOCATE PREPARE stmt_unique;

-- Add foreign key to Users(UserId) if there is no FK currently defined on SavedItems.UserId.
SET @saved_items_fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND COLUMN_NAME = 'UserId'
    AND REFERENCED_TABLE_NAME = 'Users'
    AND REFERENCED_COLUMN_NAME = 'UserId'
);

SET @sql_fk := IF(
  @saved_items_fk_exists = 0,
  'ALTER TABLE SavedItems ADD CONSTRAINT fk_saveditems_user FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE',
  'SELECT "SavedItems->Users foreign key already exists"'
);

PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

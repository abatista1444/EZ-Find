-- Rollback companion for scripts/migrate_saved_items.sql
-- Purpose:
-- 1) Remove migration-added constraints/indexes from SavedItems
-- 2) Relax strict NOT NULL requirements added by migration
-- 3) Preserve all data and columns (non-destructive rollback)
--
-- Usage:
--   mysql -u <user> -p < scripts/rollback_migrate_saved_items.sql

USE ezfind;

-- No-op if table does not exist.
SET @saved_items_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
);

-- Drop FK added by migration, if present.
SET @fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_saveditems_user'
);

SET @sql_drop_fk := IF(
  @saved_items_exists = 1 AND @fk_exists = 1,
  'ALTER TABLE SavedItems DROP FOREIGN KEY fk_saveditems_user',
  'SELECT "fk_saveditems_user not present or SavedItems missing"'
);

PREPARE stmt_drop_fk FROM @sql_drop_fk;
EXECUTE stmt_drop_fk;
DEALLOCATE PREPARE stmt_drop_fk;

-- Drop unique key added by migration, if present.
SET @unique_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SavedItems'
    AND INDEX_NAME = 'uq_saved_items_user_external'
);

SET @sql_drop_unique := IF(
  @saved_items_exists = 1 AND @unique_exists = 1,
  'ALTER TABLE SavedItems DROP INDEX uq_saved_items_user_external',
  'SELECT "uq_saved_items_user_external not present or SavedItems missing"'
);

PREPARE stmt_drop_unique FROM @sql_drop_unique;
EXECUTE stmt_drop_unique;
DEALLOCATE PREPARE stmt_drop_unique;

-- Relax strict constraints introduced by migration while preserving data.
SET @sql_relax_columns := IF(
  @saved_items_exists = 1,
  'ALTER TABLE SavedItems
     MODIFY COLUMN ExternalItemId VARCHAR(255) NULL,
     MODIFY COLUMN ItemName VARCHAR(255) NULL,
     MODIFY COLUMN Url TEXT NULL,
     MODIFY COLUMN Source VARCHAR(100) NULL',
  'SELECT "SavedItems table not found; nothing to rollback"'
);

PREPARE stmt_relax_columns FROM @sql_relax_columns;
EXECUTE stmt_relax_columns;
DEALLOCATE PREPARE stmt_relax_columns;

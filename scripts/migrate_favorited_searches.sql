-- Migration: Add favorited searches table enhancement
-- Safely adds Query column and other required fields to SavedSearches table

SET @table_name := 'SavedSearches';
SET @database_name := DATABASE();

-- Check if Query column exists and add if missing
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'Query');
SET @sql_col := IF(@col_exists = 0,
  CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN Query VARCHAR(500) NOT NULL DEFAULT \'\''),
  'SELECT 1');
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Check if Location column exists and add if missing
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'Location');
SET @sql_col := IF(@col_exists = 0,
  CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN Location VARCHAR(255)'),
  'SELECT 1');
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Check if MinPrice column exists and add if missing
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'MinPrice');
SET @sql_col := IF(@col_exists = 0,
  CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN MinPrice DECIMAL(10, 2)'),
  'SELECT 1');
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Check if MaxPrice column exists and add if missing
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'MaxPrice');
SET @sql_col := IF(@col_exists = 0,
  CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN MaxPrice DECIMAL(10, 2)'),
  'SELECT 1');
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Check if UpdatedAt column exists and add if missing
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'UpdatedAt');
SET @sql_col := IF(@col_exists = 0,
  CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
  'SELECT 1');
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Fill empty Query values with generated names from Name column
UPDATE SavedSearches SET Query = SUBSTRING(Name, 1, 500)
WHERE Query = '' OR Query IS NULL;

-- Add unique constraint on (UserId, Name) if it doesn't exist
SET @constraint_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = @table_name AND CONSTRAINT_NAME = 'uq_saved_searches_user_name');
SET @sql_col := IF(@constraint_exists = 0,
  CONCAT('ALTER TABLE ', @table_name, ' ADD UNIQUE KEY uq_saved_searches_user_name (UserId, Name)'),
  'SELECT 1');
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Ensure Query is NOT NULL
SET @col_null := (SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'Query' LIMIT 1);
SET @sql_col := IF(@col_null = 'YES',
  CONCAT('ALTER TABLE ', @table_name, ' MODIFY COLUMN Query VARCHAR(500) NOT NULL'),
  'SELECT 1');
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

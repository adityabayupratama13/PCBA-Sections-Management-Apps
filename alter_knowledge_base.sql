-- This script was applied directly to the database to fix the 'Data too long' error
-- when saving Knowledge Base articles containing long rich-text HTML content.
ALTER TABLE giken_db.articles MODIFY COLUMN content LONGTEXT;

-- Replace like/yikes with emoji reactions
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_kind_check;
ALTER TABLE reactions ALTER COLUMN kind TYPE VARCHAR(20);
DELETE FROM reactions;

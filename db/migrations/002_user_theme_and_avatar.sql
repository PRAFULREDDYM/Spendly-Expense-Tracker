ALTER TABLE users ADD COLUMN avatar_url TEXT NULL;

ALTER TABLE user_preferences ADD COLUMN theme TEXT NOT NULL DEFAULT 'system';

ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signed_prekey TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signed_prekey_signature TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signed_prekey_id INT;

CREATE TABLE IF NOT EXISTS prekeys (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id INT NOT NULL,
    public_key TEXT NOT NULL,
    UNIQUE(user_id, key_id)
);
CREATE INDEX IF NOT EXISTS idx_prekeys_user ON prekeys(user_id);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS signature TEXT;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type INT;

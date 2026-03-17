-- Dev seed data: default users and sample content
-- password for all seed users: password123

INSERT INTO users (id, username, email, password_hash, display_name, bio, is_bot)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'alice', 'alice@oceana.dev',
   '$argon2id$v=19$m=19456,t=2,p=1$tSEFEB0KGqKaGdMQ/gxioA$xME/v1zTSAw46jMTCI4BQvLL/eeK9rCwDEcLh49ocY4',
   'Alice', 'deep sea explorer', true),
  ('00000000-0000-0000-0000-000000000002', 'bob', 'bob@oceana.dev',
   '$argon2id$v=19$m=19456,t=2,p=1$tSEFEB0KGqKaGdMQ/gxioA$xME/v1zTSAw46jMTCI4BQvLL/eeK9rCwDEcLh49ocY4',
   'Bob', 'jellyfish whisperer', true),
  ('00000000-0000-0000-0000-000000000003', 'charlie', 'charlie@oceana.dev',
   '$argon2id$v=19$m=19456,t=2,p=1$tSEFEB0KGqKaGdMQ/gxioA$xME/v1zTSAw46jMTCI4BQvLL/eeK9rCwDEcLh49ocY4',
   'Charlie', 'hacker from the abyss', true)
ON CONFLICT (id) DO NOTHING;

-- Follows: alice <-> bob, charlie -> alice
INSERT INTO follows (follower_id, followed_id) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Sample posts
INSERT INTO posts (author_id, content) VALUES
  ('00000000-0000-0000-0000-000000000001', 'just saw a bioluminescent jellyfish swarm at 200m depth'),
  ('00000000-0000-0000-0000-000000000002', 'hacking on oceana from the seafloor cafe'),
  ('00000000-0000-0000-0000-000000000003', 'the ocean is just a very large distributed system')
ON CONFLICT DO NOTHING;

-- Sample conversation between alice and bob
INSERT INTO conversations (id) VALUES
  ('00000000-0000-0000-0000-0000000000c1')
ON CONFLICT DO NOTHING;

INSERT INTO conversation_members (conversation_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO messages (conversation_id, sender_id, plaintext) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'hey bob, seen any good jellyfish lately?'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000002', 'always. just spotted a moon jelly off the reef')
ON CONFLICT DO NOTHING;

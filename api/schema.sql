-- 8wut Database Schema
-- Run this once against your PostgreSQL database

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url  TEXT DEFAULT 'https://i.pravatar.cc/150?u=' || gen_random_uuid(),
  bio         TEXT DEFAULT '',
  is_admin    BOOLEAN DEFAULT FALSE,
  invite_code_used TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Invite codes
CREATE TABLE IF NOT EXISTS invite_codes (
  code        TEXT PRIMARY KEY,
  created_by  UUID REFERENCES users(id),
  max_uses    INT DEFAULT 1,
  times_used  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption         TEXT NOT NULL DEFAULT '',
  text_background TEXT,
  scope           VARCHAR(20) DEFAULT 'everyone',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Post images (ordered)
CREATE TABLE IF NOT EXISTS post_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INT DEFAULT 0
);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Fridge saves
CREATE TABLE IF NOT EXISTS fridge_saves (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Follows
CREATE TABLE IF NOT EXISTS follows (
  follower_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL, -- 'like', 'comment', 'follow', 'fridge'
  post_id       UUID REFERENCES posts(id) ON DELETE CASCADE,
  read          BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_images_post ON post_images(post_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

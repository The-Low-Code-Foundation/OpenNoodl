-- Seed for the BCN-001 aggregate-capability probe stack.
--
-- Same shape as supabase-seed.sql (RUN-003's parser verification) but with
-- enough rows, spread across enough groups, that an aggregate result is
-- distinguishable from a row count or a single row. Deliberately a separate
-- file so RUN-003's recorded output stays reproducible.
CREATE ROLE web_anon NOLOGIN;

CREATE TYPE article_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE authors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE
);

CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  status article_status DEFAULT 'draft',
  rating INTEGER,
  featured BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  author_id INTEGER REFERENCES authors (id)
);

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT SELECT ON authors, articles TO web_anon;

INSERT INTO authors (name, email) VALUES
  ('Ada', 'ada@example.com'),
  ('Grace', 'grace@example.com');

-- 7 rows / 3 statuses / 2 authors. sum(rating) = 25, avg over published = 4.
INSERT INTO articles (title, status, rating, featured, author_id) VALUES
  ('Published one',   'published', 5, TRUE,  1),
  ('Published two',   'published', 3, FALSE, 1),
  ('Published three', 'published', 4, FALSE, 2),
  ('Draft one',       'draft',     2, FALSE, 1),
  ('Draft two',       'draft',     4, FALSE, 2),
  ('Archived one',    'archived',  5, FALSE, 2),
  ('Archived two',    'archived',  2, FALSE, 1);

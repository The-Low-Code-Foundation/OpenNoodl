-- Seed for the Supabase-shaped (PostgREST) verification stack.
-- Mirrors the Directus seed's "interesting cases": relation (FK), enum,
-- timestamp, numeric, boolean.
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

INSERT INTO authors (name, email) VALUES ('Ada', 'ada@example.com');
INSERT INTO articles (title, status, rating, featured, author_id)
VALUES ('Seeded article', 'published', 5, TRUE, 1);

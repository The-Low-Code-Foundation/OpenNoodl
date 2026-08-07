-- BCN-003's equivalence corpus, for the PostgREST half of the rig.
--
-- Mounted alongside `bcn-001-agg-seed.sql` on the same `agg-db`, because
-- docker-entrypoint-initdb.d runs every file in it in name order and BCN-001's
-- probe only ever reads `articles`/`authors`. A separate file rather than an
-- addition to that one, so BCN-001's recorded output stays reproducible.
--
-- ⚠️ Only runs on a **fresh volume**. `docker compose --profile aggregate down -v`
-- before bringing the stack up, or this table will not exist.
--
-- The rows are chosen so that each one discriminates between operators that a
-- careless translator would confuse:
--
--   Ada / Adam / adaline  — a case-sensitivity discriminator for contains,
--                           startsWith and matchesRegex. `contains 'Ada'`
--                           must not match `adaline`.
--   Adam's empty bio      — `isEmpty` is a different question from `exists`,
--                           and Grace's NULL bio is the other half of it.
--   Q"uote && Co          — the injection case, live. A value carrying a double
--                           quote, an ampersand pair and a comma must come back
--                           as one row, not as a rewritten query.
--   100% sure / 1000 words — the LIKE-wildcard case. `contains '100%'` must
--                           match the first and not the second; unescaped, `%`
--                           is a wildcard and matches both.

CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  city TEXT,
  active BOOLEAN,
  bio TEXT
);

GRANT SELECT ON people TO web_anon;

INSERT INTO people (name, age, city, active, bio) VALUES
  ('Ada',          36, 'London',   TRUE,  'mathematician'),
  ('Adam',         41, 'Bristol',  FALSE, ''),
  ('Grace',        45, 'New York', TRUE,  NULL),
  ('adaline',      29, 'London',   TRUE,  'engineer'),
  ('Charles',      60, 'London',   FALSE, 'inventor'),
  ('Q"uote && Co',  1, 'Edge',     TRUE,  '100% sure'),
  ('Thousand',      2, 'Edge',     TRUE,  '1000 words');

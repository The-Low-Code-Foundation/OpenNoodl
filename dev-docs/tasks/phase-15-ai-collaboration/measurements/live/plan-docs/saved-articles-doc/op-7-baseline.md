# Architecture

## What this app is

A reader for the articles we publish through Contentful. Everything a reader
sees comes from Contentful; everything a reader *does* — ratings, comments —
lives in the Noodl database, keyed by the Contentful article id.

## Pages

- **Article** — the reader's whole world. Deep-linked by `pm-slug`.
- **Profile** — account settings and the reader's own comments.

The App shell owns the only Router. Pages are registered there and nowhere
else; if a page is not in that list it is unreachable, and we have shipped that
bug twice.

## Data

We do not mirror Contentful into the database. An article's *content* is always
fetched live; only reader-generated records are stored, and each one carries the
Contentful `article_id` rather than a copy of the article.

We considered caching articles in the Noodl database so the app could open
offline. Rejected: the editorial team corrects live articles several times a
week, and a cache that serves a corrected article's old text is worse than a
spinner.

## Auth

Email/password through the backend's user records. Anything that writes a
reader-generated record must go through `Is user logged in?` first.

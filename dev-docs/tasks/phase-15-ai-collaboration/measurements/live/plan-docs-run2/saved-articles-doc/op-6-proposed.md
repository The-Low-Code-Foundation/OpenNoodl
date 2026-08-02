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

A nav entry to a "Saved" page has been added, gated by `Is user logged in?`,
but the page itself does not exist yet — the entry currently has nowhere to
route to.

## Data

We do not mirror Contentful into the database. An article's *content* is always
fetched live; only reader-generated records are stored, and each one carries the
Contentful `article_id` rather than a copy of the article.

We considered caching articles in the Noodl database so the app could open
offline. Rejected: the editorial team corrects live articles several times a
week, and a cache that serves a corrected article's old text is worse than a
spinner.

`articleId` (the Contentful id) is the single canonical way this app identifies
an article. Every reader-generated record — ratings, and now saved articles —
keys off it rather than any local id. `SavedArticle` records are `userId` +
`articleId`, deliberately mirroring how ratings are keyed. Do not introduce a
second identifier for articles; resolve display data by looking the
`articleId` up through Contentful (`Get Article From Slug` /
`Contentful GraphQL`) rather than storing a copy or a different key.

## Auth

Email/password through the backend's user records. Anything that writes a
reader-generated record must go through `Is user logged in?` first.

# Brief

## What this app is

A one-page log: type a line, press Log it, and it is saved to the built-in database and appears in the list below. It exists to teach one rule — the Visual Function computes, the canvas does the async work, and the signal wire is the await.

## Who uses it

A builder taking their first NodeGX tutorial, who has asked (or is about to ask) "how do I call the database from blocks?"

## Deliberately out of scope

- Editing or deleting an entry - the tutorial teaches the create/read composition and stops there
- Sign-in or per-user entries
- Any second page; a Router with one route is enough to make the page reachable
- Async blocks inside the Visual Function - this project exists to teach that they are deliberately absent

_Agreed in the initial scoping conversation; the full record, including what was considered and rejected, is in `docs/decisions/000-initial-scope.md`._

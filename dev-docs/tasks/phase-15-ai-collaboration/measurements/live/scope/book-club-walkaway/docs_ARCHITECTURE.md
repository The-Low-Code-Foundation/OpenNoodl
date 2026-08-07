# Architecture

## Page map

> TODO: No pages were agreed during scoping.

## Data model

### Book

The book picked for a given month

Fields:
- title
- author
- month/date picked

### Member

A signed-in book club member

Fields:
- name
- email

### Review

A member's short writeup and rating for a Book

Fields:
- rating (1-5)
- text

Relationships:
- belongs to one Member
- belongs to one Book

## Backend contracts

Needed — stores Users, Books, and Reviews; supports email/password auth

## Decisions

> TODO: No alternatives were weighed during scoping. The next significant choice belongs here.

_Scoping record: `docs/decisions/000-initial-scope.md`._

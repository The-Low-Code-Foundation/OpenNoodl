# Architecture

## Page map

- **Login** (`Pages/Login`) — Email/password sign in and sign up for club members
- **Library** (`Pages/Library`) — Lists all books picked so far by month; where new books get added
- **Book detail** (`Pages/Book detail`) — Shows one book's info, its reviews, average rating, and lets the logged-in member add their own review

## Data model

### Member

A book club member with an account

Fields:
- email
- password/auth
- display name

### Book

A book the club has picked for a given month

Fields:
- title
- author
- month/date picked

### Review

A member's short review and rating of a Book

Fields:
- rating (1-5)
- review text

Relationships:
- belongs to one Book
- belongs to one Member

## Backend contracts

Cloud database with email/password authentication; stores Books and Reviews, reviews linked to the authenticated member

## Decisions

Considered during scoping and deliberately not done:

- **Members propose books and vote on the monthly pick** — Whoever hosts that month just picks the book directly; voting adds complexity with no real benefit

Left open:

> TODO: Can a member edit or delete their own review after posting, or is it add-and-done?

_Scoping record: `docs/decisions/000-initial-scope.md`._

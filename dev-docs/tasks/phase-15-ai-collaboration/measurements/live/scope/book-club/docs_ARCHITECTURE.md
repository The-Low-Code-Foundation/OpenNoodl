# Architecture

## Page map

- **Library** (`Pages/Library`) — Lists all books picked so far; where a new monthly book is added
- **Book detail** (`Pages/Book detail`) — Shows one book and all its reviews; where a signed-in member leaves their own review
- **Sign in / Sign up** (`Pages/Sign in Sign up`) — Email/password authentication for members

## Data model

### Member

A book club member who can sign in and leave reviews

Fields:
- name
- email

Relationships:
- has many Reviews

### Book

The book picked for a given month

Fields:
- title
- author
- month/date picked

Relationships:
- has many Reviews

### Review

A member's short review and rating for a book

Fields:
- rating (1-5)
- short text

Relationships:
- belongs to one Book
- belongs to one Member

## Backend contracts

Needed for auth (email/password) plus storing books, reviews, and members.

## Decisions

Considered during scoping and deliberately not done:

- **In-app voting for next book pick** — whoever hosts just picks the book; voting not wanted

Left open:

> TODO: Should a member be able to edit or delete their own review after posting?

_Scoping record: `docs/decisions/000-initial-scope.md`._

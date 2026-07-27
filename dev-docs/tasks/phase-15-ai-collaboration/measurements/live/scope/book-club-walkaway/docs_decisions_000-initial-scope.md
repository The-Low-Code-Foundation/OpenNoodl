# 000 — Initial scope

_Recorded 1970-01-01T00:00:00.000Z, from the scoping conversation held before this project was created._

## What was asked for

> I want to build an app for my book club. We pick a book each month and everyone leaves a short review with a rating out of five.

## What was decided

**The app.** An app for a book club to track its monthly book pick and let members leave short reviews with a 1-5 rating.

**Records.**

- Book — The book picked for a given month — title, author, month/date picked
- Member — A signed-in book club member — name, email
- Review — A member's short writeup and rating for a Book — rating (1-5), text — belongs to one Member; belongs to one Book

**Backend.** Needed — stores Users, Books, and Reviews; supports email/password auth

## What was considered and rejected

> TODO: No alternatives were weighed. If one was and it is missing here, add it.

## Deliberately out of scope

- In-app chat or discussion threads (they already use WhatsApp for that)

## Still open

Nothing was left open in the conversation.

## Proposed build plan

No pages were agreed, so no plan was produced.

## Transcript

**You:**

> I want to build an app for my book club. We pick a book each month and everyone leaves a short review with a rating out of five.

**Assistant:**

> Got it — recorded what I know so far, and that account question is the one to settle first.
>
> Do reviewers need to log in with an account (so reviews are provably theirs and they can edit/delete only their own), or is this a small trusted group where anyone can just type their name and post — no login at all?

**You:**

> About twelve of us, all on our phones. We already have a WhatsApp group so I do not want chat in the app — just the books and the reviews.

**Assistant:**

> Makes sense — no chat, that's what WhatsApp is for. This is just the shared record of books and reviews.
>
> Given it's a trusted group of 12 people, I'd lean toward no login at all — you type your name when you post a review. Much simpler to build, and matches "small trusted group." Downside: nothing stops someone editing someone else's review, but for 12 friends that's probably fine.
>
> Shall we go with no accounts, name typed per review?

**You:**

> Yes, people need to sign in so we know whose review is whose. Nothing fancy, email and password is fine.

**Assistant:**

> Exactly right — Member, Book, and Review, with reviews tied to both.
>
> Now, who picks the book each month — does anyone in the group get to add/change the current book, or should that be limited to one person (like an organizer role)?

**You:**

> I thought about letting people propose books and vote, but honestly whoever hosts picks the book, so no voting. That is everything.

**Assistant:**

> Good call dropping voting — that's exactly the kind of feature that sounds nice but adds a lot of build for little payoff in a 12-person group.
>
> So: any member can add the month's book (whoever's hosting just adds it), and any signed-in member can leave one review per book. Let's talk pages. I'm picturing:
>
> - **Sign in / Sign up** — email/password
> - **Library** — list of all books picked so far, tap one to see detail; also where you add a new book
> - **Book detail** — shows the book plus all reviews and ratings for it, and a way to add your own review
>
> That's three pages, pretty minimal. Does that match what you pictured, or did you want a separate "add book" page instead of doing it from the Library?

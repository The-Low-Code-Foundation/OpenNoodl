# 000 — Initial scope

_Recorded 1970-01-01T00:00:00.000Z, from the scoping conversation held before this project was created._

## What was asked for

> I want to build an app for my book club. We pick a book each month and everyone leaves a short review with a rating out of five.

## What was decided

**The app.** An app for a book club: each month the club picks a book, and members leave a short review with a rating out of five for it.

**Pages.**

- Login — Email/password sign in and sign up for club members
- Library — Lists all books picked so far by month; where new books get added
- Book detail — Shows one book's info, its reviews, average rating, and lets the logged-in member add their own review

**Records.**

- Member — A book club member with an account — email, password/auth, display name
- Book — A book the club has picked for a given month — title, author, month/date picked
- Review — A member's short review and rating of a Book — rating (1-5), review text — belongs to one Book; belongs to one Member

**Backend.** Cloud database with email/password authentication; stores Books and Reviews, reviews linked to the authenticated member

**Rules for this project.**

- No chat/messaging features — reviews only
- Reviews are tied to the logged-in member's account, not a free-typed name

## What was considered and rejected

This is the section with the longest shelf life. It is what stops the next reader — or the next
assistant — helpfully rebuilding something that was deliberately left out.

- **Members propose books and vote on the monthly pick** — rejected: Whoever hosts that month just picks the book directly; voting adds complexity with no real benefit

## Deliberately out of scope

- Chat or discussion threads (handled in existing WhatsApp group)
- User accounts/authentication

## Still open

> TODO: Can a member edit or delete their own review after posting, or is it add-and-done?

## Proposed build plan

Produced from the scope above and handed over unexecuted — no components were authored during
scoping. Review it before building.

1. **create `Pages/Login`** — Email/password sign in and sign up for club members Works with the Member record described in docs/ARCHITECTURE.md. Sibling pages in this app: Library, Book detail. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do.
2. **create `Pages/Library`** — Lists all books picked so far by month; where new books get added Works with the Book record described in docs/ARCHITECTURE.md. Sibling pages in this app: Login, Book detail. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do.
3. **create `Pages/Book detail`** — Shows one book's info, its reviews, average rating, and lets the logged-in member add their own review Works with the Member and Book and Review records described in docs/ARCHITECTURE.md. Sibling pages in this app: Login, Library. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do.

## Transcript

**You:**

> I want to build an app for my book club. We pick a book each month and everyone leaves a short review with a rating out of five.

**Assistant:**

> Got it — that's recorded. So, to confirm: no accounts for now, members just type their name when leaving a review, unless you tell me otherwise.
>
> Does that match what you had in mind, or do you actually want people to log in?

**You:**

> About twelve of us, all on our phones. We already have a WhatsApp group so I do not want chat in the app — just the books and the reviews.

**Assistant:**

> Good — and to your question: I'd fold "add a book" into the Library page rather than a separate page, since it's a quick one-off action, not something worth its own screen to maintain. Same logic for adding a review — it lives right on the Book detail page, not its own page.
>
> One more thing worth pinning down: should there be any backend/database so books and reviews persist and sync across everyone's phones, or is this just for one phone/local use? With 12 people all using it, I'm guessing you want shared, persistent data.

**You:**

> Yes, people need to sign in so we know whose review is whose. Nothing fancy, email and password is fine.

**Assistant:**

> Also — should a member be able to edit or delete their own review after posting, or is it a one-shot "add and done"? Worth deciding now since it affects the Book detail page.

**You:**

> I thought about letting people propose books and vote, but honestly whoever hosts picks the book, so no voting. That is everything.

**Assistant:**

> That's locked in. To recap: it's a book club app with Login, Library, and Book detail pages, backed by a simple cloud database with email/password auth. Members see the monthly picks, and can rate and review the current book under their own name — no chat, no voting, no book proposals. The one open question left for the build step is whether reviews can be edited/deleted after posting.
>
> That's a solid, small first version. You're good to move to the build step whenever you're ready.

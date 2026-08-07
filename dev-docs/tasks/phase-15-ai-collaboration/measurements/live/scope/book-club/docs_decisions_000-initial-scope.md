# 000 — Initial scope

_Recorded 1970-01-01T00:00:00.000Z, from the scoping conversation held before this project was created._

## What was asked for

> I want to build an app for my book club. We pick a book each month and everyone leaves a short review with a rating out of five.

## What was decided

**The app.** An app for a ~12-person book club: members sign in with email/password, see the monthly book pick, and leave a short review with a 1-5 rating. No chat (WhatsApp covers that) and no voting on picks.

**Who it is for.** About 12 book club members, all on phones, who already use WhatsApp for chat/discussion.

**Pages.**

- Library — Lists all books picked so far; where a new monthly book is added
- Book detail — Shows one book and all its reviews; where a signed-in member leaves their own review
- Sign in / Sign up — Email/password authentication for members

**Records.**

- Member — A book club member who can sign in and leave reviews — name, email — has many Reviews
- Book — The book picked for a given month — title, author, month/date picked — has many Reviews
- Review — A member's short review and rating for a book — rating (1-5), short text — belongs to one Book; belongs to one Member

**Backend.** Needed for auth (email/password) plus storing books, reviews, and members.

## What was considered and rejected

This is the section with the longest shelf life. It is what stops the next reader — or the next
assistant — helpfully rebuilding something that was deliberately left out.

- **In-app voting for next book pick** — rejected: whoever hosts just picks the book; voting not wanted

## Deliberately out of scope

- In-app chat or discussion (they use WhatsApp for that)
- Proposing books or voting on the next pick

## Still open

> TODO: Should a member be able to edit or delete their own review after posting?

## Proposed build plan

Produced from the scope above and handed over unexecuted — no components were authored during
scoping. Review it before building.

1. **create `Pages/Library`** — Lists all books picked so far; where a new monthly book is added Works with the Book record described in docs/ARCHITECTURE.md. Sibling pages in this app: Book detail, Sign in / Sign up. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do.
2. **create `Pages/Book detail`** — Shows one book and all its reviews; where a signed-in member leaves their own review Works with the Member and Book and Review records described in docs/ARCHITECTURE.md. Sibling pages in this app: Library, Sign in / Sign up. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do.
3. **create `Pages/Sign in Sign up`** — Email/password authentication for members Works with the Member record described in docs/ARCHITECTURE.md. Sibling pages in this app: Library, Book detail. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do.

## Transcript

**You:**

> I want to build an app for my book club. We pick a book each month and everyone leaves a short review with a rating out of five.

**Assistant:**

> What's your gut on that — accounts, or keep it name-and-go with no login?

**You:**

> About twelve of us, all on our phones. We already have a WhatsApp group so I do not want chat in the app — just the books and the reviews.

**Assistant:**

> *(waiting on your answer about accounts vs. name-and-go)*

**You:**

> Yes, people need to sign in so we know whose review is whose. Nothing fancy, email and password is fine.

**Assistant:**

> Just to confirm — voting isn't something you asked for, so I'll leave it out for now: whoever organizes the club just adds the book manually each month. Let me know if that's wrong.
>
> Next: pages. I'm thinking three: a **Library** (list of past/current books, and where you add a new one), a **Book detail** page (shows the book plus all its reviews, and where you leave your own review), and a simple **Sign in / Sign up** page. That covers it without extra pages to maintain — does that match what you pictured, or were you imagining a separate page just for "leave a review"?

**You:**

> I thought about letting people propose books and vote, but honestly whoever hosts picks the book, so no voting. That is everything.

**Assistant:**

> Locked in. That's the scope: Library, Book detail, and Sign in/Sign up pages, with Member, Book, and Review as the core objects, email/password auth, no chat, no voting.
>
> The one thing left open — whether members can edit/delete their own review later — is noted as a TODO for you to decide during build; it won't block getting started.
>
> This is ready to hand off whenever you want to begin building in Noodl.

**You:**

> Yes, those three pages are exactly right. Go with that.

**Assistant:**

> Great — the scope is locked and recorded. You're all set to start building in Noodl whenever you're ready. Good luck with the book club app!

---
title: Start here
inject: pull
when: copy, text, editing, landing page, contact form, email address, which page, delete, start page
---

# Start here

Three landing pages ship in this project, each a complete site of a different
kind. **Keep one, delete the other two, change the words, publish.** There is no
backend to set up: the contact form opens the visitor's own mail app with the
message written and addressed to you.

## 1. Pick a look

The strip across the top of every page flicks between the three:

| page | route | for |
|---|---|---|
| `Pages/Freelancer` | `/` | one person selling a skill — services, recent work, a word from a client |
| `Pages/Business` | `/business` | a place people visit — a photograph, what it sells, where it is, when it opens |
| `Pages/Launch` | `/launch` | something that does not exist yet — the promise, how it works, the numbers, the questions |

When you have chosen: delete the two page components you do not want, and if
the one you kept is not `Pages/Freelancer`, open the **App** component, select
the **Main** router and make your page the start page with an empty URL path.
Then delete `Site/Switcher` — the strip is for choosing, not for visitors.

## 2. The address the form sends to — change this first

`Site/Contact` has one node named **EDIT — the address the form sends to**. It says
`EDIT ME — you@example.com` today. Put your own address in it; the form and the
line beside the form both read from that one node.

## 3. Everything else that is yours to write

No business, client or number on these pages is invented. Every string you have
to replace is written in the shape of the thing it stands for and its node is
named with an **`EDIT —`** prefix, so the editor's node tree lists them. Search
the tree for `EDIT` and the tables below are what you will find. Change the
text, or delete the node if it does not apply to you.

### `Pages/Business`

| node | what it says today |
|---|---|
| **EDIT — a photograph of the street or the door** | noodl_modules/starter-imagery/food-grocer.webp |
| **EDIT — number 1 on the hero** | value: 2009 · label: The year you opened |
| **EDIT — number 2 on the hero** | value: 4.9 · label: Your rating, and where from |
| **EDIT — number 3 on the hero** | value: 7 days · label: Something true about the place |
| **EDIT — opening hours, holidays** | day: Bank holidays · time: Closed |
| **EDIT — opening hours, Saturday** | day: Saturday · time: 8am – 5pm |
| **EDIT — opening hours, Sunday** | day: Sunday · time: 9am – 3pm |
| **EDIT — opening hours, weekdays** | day: Monday to Friday · time: 7am – 6pm |
| **EDIT — the address** | Your street address, your town, your postcode. Delete this and write yours. |
| **EDIT — the badge on the hero** | Open today until six |
| **EDIT — the first reason** | icon: leaf · title: The first reason · line: Where things come from, who makes them, what you refuse to do. |
| **EDIT — the first regular’s words** | quote: “A sentence or two a customer actually said. Pull it from a review if you have one.” · name: Their name · role: A regular since whenever · portrait: noodl_modules/starter-imagery/avatar-3.webp · alt: A woman smiling in a hooded coat |
| **EDIT — the first thing you sell** | picture: noodl_modules/starter-imagery/food-bread.webp · alt: Sourdough loaves · title: The first thing · line: One line on it: what it is, when it is ready, what it costs. · detail: What is in it, where it comes from, and what happens if somebody wants twenty of them. |
| **EDIT — the headline** | What you make, and why people cross town for it |
| **EDIT — the line under the headline** | One sentence on the place itself: the street it is on, the people behind the counter, what it smells like at eight in the morning. |
| **EDIT — the second reason** | icon: heart · title: The second reason · line: The people. Say who is behind the counter and how long they have been. |
| **EDIT — the second regular’s words** | quote: “Another one. Real words beat polished ones; leave the typos in if you like.” · name: Their name · role: A regular since whenever · portrait: noodl_modules/starter-imagery/avatar-1.webp · alt: A young man laughing |
| **EDIT — the second thing you sell** | picture: noodl_modules/starter-imagery/food-plate.webp · alt: A plated dish · title: The second thing · line: One line on it: what it is, when it is ready, what it costs. · detail: What is in it, where it comes from, and what happens if somebody wants twenty of them. |
| **EDIT — the third reason** | icon: truck · title: The third reason · line: Something practical: delivery, parking, a room for a party. |
| **EDIT — the third thing you sell** | picture: noodl_modules/starter-imagery/texture-coffee.webp · alt: Roasted coffee beans · title: The third thing · line: One line on it: what it is, when it is ready, what it costs. · detail: What is in it, where it comes from, and what happens if somebody wants twenty of them. |
| **EDIT — the three nav links at the top** | nav1: What we make · nav1Target: section-bzOffer · nav2: Why here · nav2Target: section-bzWhy · nav3: Visit · nav3Target: section-bzVisit |
| **EDIT — What we make — heading** | Three things people come in for |
| **EDIT — Why here — heading** | Three reasons this is the place |

### `Pages/Freelancer`

| node | what it says today |
|---|---|
| **EDIT — a photograph of you at work** | noodl_modules/starter-imagery/people-cafe.webp |
| **EDIT — About — first paragraph** | How you came to do this work, and how long you have been doing it. Say it the way you would say it to a client across a table. |
| **EDIT — About — heading** | A short story about you |
| **EDIT — About — second paragraph** | What you care about in the work, and what working with you is like. One paragraph is enough. |
| **EDIT — About — where you are** | Based in your town · working with people everywhere |
| **EDIT — Recent work — heading** | The work, and the story behind each piece |
| **EDIT — the badge on the hero** | Taking new projects from next month |
| **EDIT — the first client’s words** | quote: “A sentence or two a client actually said about working with you. Ask them; most people are glad to.” · name: Their name · role: What they do, and where · portrait: noodl_modules/starter-imagery/avatar-4.webp · alt: A man smiling, arms folded |
| **EDIT — the first kind of work** | label: The first kind of work · value: The first kind of work |
| **EDIT — the first service** | icon: pencil · title: The first service · price: From — say a number, or “on a day rate” · line: One line on what it includes. · detail: How the work actually goes: what you need from them at the start, how long it takes, how often they hear from you. · deliverable: What lands in their inbox at the end, and in what form. |
| **EDIT — the headline** | One line that says what you do, and who it is for |
| **EDIT — the line under the headline** | Two sentences on the difference it makes for the people who hire you. Keep it plain; this is the first thing they read. |
| **EDIT — the second client’s words** | quote: “Another client, in their own words. Two quotes is plenty; three is a wall.” · name: Their name · role: What they do, and where · portrait: noodl_modules/starter-imagery/avatar-5.webp · alt: A woman smiling outdoors |
| **EDIT — the second kind of work** | label: The second kind of work · value: The second kind of work |
| **EDIT — the second service** | icon: layout-grid · title: The second service · price: From — say a number, or “on a day rate” · line: One line on what it includes. · detail: The same three things for this one. If two services have the same answer here, they are probably one service. · deliverable: What they end up with, described as a thing rather than an activity. |
| **EDIT — the third kind of work** | label: The third kind of work · value: The third kind of work |
| **EDIT — the third service** | icon: line-chart · title: The third service · price: From — say a number, or “on a day rate” · line: One line on what it includes. · detail: Three services is the most a page like this can carry. If you have five, the other two belong on their own page. · deliverable: What they end up with, described as a thing rather than an activity. |
| **EDIT — the three nav links at the top** | nav1: What I do · nav1Target: section-flServices · nav2: Work · nav2Target: section-flWork · nav3: About · nav3Target: section-flAbout |
| **EDIT — the work itself — this list IS the page** | type: json · json: [
  {
    "picture": "noodl_modules/starter-imagery/work-leather-bench.webp",
    "alt": "A leather workbench with tools laid out",
    "category": "The first kind of work",
    "title": "A piece of work",
    "client": "Who it was for",
    "year": "2026",
    "summary": "One line on what it was and what changed. This is all the card shows.",
    "brief": "What they came to you with, and what was hard about it. Two sentences.",
    "did": "What you actually did — the decisions, not the deliverables. Two or three sentences.",
    "outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."
  },
  {
    "picture": "noodl_modules/starter-imagery/food-bakery.webp",
    "alt": "A bakery counter with loaves on it",
    "category": "The first kind of work",
    "title": "Another of the same kind",
    "client": "Who it was for",
    "year": "2025",
    "summary": "One line on what it was and what changed. This is all the card shows.",
    "brief": "What they came to you with, and what was hard about it. Two sentences.",
    "did": "What you actually did — the decisions, not the deliverables. Two or three sentences.",
    "outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."
  },
  {
    "picture": "noodl_modules/starter-imagery/people-desk.webp",
    "alt": "Someone working at a laptop by a window",
    "category": "The second kind of work",
    "title": "A piece of a different kind",
    "client": "Who it was for",
    "year": "2026",
    "summary": "One line on what it was and what changed. This is all the card shows.",
    "brief": "What they came to you with, and what was hard about it. Two sentences.",
    "did": "What you actually did — the decisions, not the deliverables. Two or three sentences.",
    "outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."
  },
  {
    "picture": "noodl_modules/starter-imagery/work-machine-shop.webp",
    "alt": "A machine shop with a lathe in use",
    "category": "The second kind of work",
    "title": "Another of that kind",
    "client": "Who it was for",
    "year": "2025",
    "summary": "One line on what it was and what changed. This is all the card shows.",
    "brief": "What they came to you with, and what was hard about it. Two sentences.",
    "did": "What you actually did — the decisions, not the deliverables. Two or three sentences.",
    "outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."
  },
  {
    "picture": "noodl_modules/starter-imagery/people-meeting.webp",
    "alt": "Three people talking around a table",
    "category": "The third kind of work",
    "title": "A piece of the third kind",
    "client": "Who it was for",
    "year": "2024",
    "summary": "One line on what it was and what changed. This is all the card shows.",
    "brief": "What they came to you with, and what was hard about it. Two sentences.",
    "did": "What you actually did — the decisions, not the deliverables. Two or three sentences.",
    "outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."
  },
  {
    "picture": "noodl_modules/starter-imagery/work-potter.webp",
    "alt": "A potter shaping a bowl on a wheel",
    "category": "The third kind of work",
    "title": "The last one on the list",
    "client": "Who it was for",
    "year": "2024",
    "summary": "One line on what it was and what changed. This is all the card shows.",
    "brief": "What they came to you with, and what was hard about it. Two sentences.",
    "did": "What you actually did — the decisions, not the deliverables. Two or three sentences.",
    "outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."
  }
] |
| **EDIT — What I do — heading** | Three things I can take off your plate |

### `Pages/Launch`

| node | what it says today |
|---|---|
| **EDIT — a picture of the product goes here (this window is a stand-in)** | title: What the product shows first · row1: The first thing in it · row2: The second thing in it · row3: The third thing in it |
| **EDIT — a picture of the product goes here (this window is a stand-in)** | title: The first thing, shown · row1: A row that shows it · row2: Another row · row3: A third row |
| **EDIT — a picture of the product goes here (this window is a stand-in)** | title: The second thing, shown · row1: A row that shows it · row2: Another row · row3: A third row |
| **EDIT — How it works — heading** | Three steps, one afternoon |
| **EDIT — Questions — heading** | The things people ask before they sign up |
| **EDIT — the badge on the hero** | Launching this spring |
| **EDIT — the closing line** | Be first through the door |
| **EDIT — the first plan** | name: While it is in beta · line: For everyone who joins before launch. · point1: Everything it does today · point2: A say in what it does next · point3: Your price held when it launches · action: Get early access · ground: var(--surface) · edge: var(--border) · ink: var(--foreground) |
| **EDIT — the first question** | question: The question people ask first · answer: The honest answer, in two sentences. If the answer is “not yet”, say so and say when. |
| **EDIT — the first step** | number: 01 · title: The first step · line: What they do first, and how long it takes. This is the only step that costs them anything. |
| **EDIT — The first thing — heading** | What it does, said as a benefit |
| **EDIT — The first thing — point 1** | text: A specific thing it does |
| **EDIT — The first thing — point 2** | text: Another specific thing it does |
| **EDIT — The first thing — point 3** | text: The thing people will not believe until they try it |
| **EDIT — The first thing — the paragraph** | A paragraph on the problem it removes. Describe the Tuesday afternoon it saves, not the feature list. |
| **EDIT — the fourth question** | question: Whether they can leave · answer: How to cancel, and what happens to what they made. |
| **EDIT — the headline** | The promise, in one line, in words a customer would use |
| **EDIT — the line under the closing line** | One sentence on what the first people in get that nobody else will. |
| **EDIT — the line under the headline** | Two sentences on what it replaces and what it feels like to use instead. Say the boring thing it saves people from. |
| **EDIT — the number, first** | value: 2,400 · label: Of the thing it counts, in the pilot |
| **EDIT — the number, second** | value: 98% · label: Of the thing it improves |
| **EDIT — the number, third** | value: 11 min · label: Saved every time, on average |
| **EDIT — The numbers — heading** | Three numbers you can stand behind |
| **EDIT — The price — heading** | Say the number |
| **EDIT — the second plan** | name: After launch · line: Everything in the first plan, and the thing people pay for. · point1: Everything in the first plan · point2: The thing the paid plan adds · point3: The other thing it adds · action: Join the list · ground: var(--foreground) · edge: var(--foreground) · ink: var(--primary-foreground) |
| **EDIT — the second question** | question: Whether their data is safe · answer: Where it lives, who can see it, and how they get it out again. |
| **EDIT — the second step** | number: 02 · title: The second step · line: What happens next, without them doing anything. |
| **EDIT — The second thing — heading** | The second thing, as a benefit |
| **EDIT — The second thing — point 1** | text: A specific thing it does |
| **EDIT — The second thing — point 2** | text: Another specific thing it does |
| **EDIT — The second thing — point 3** | text: What it costs them if they keep doing it by hand |
| **EDIT — The second thing — the paragraph** | A paragraph on what happens on its own once it is set up. Say what they never have to think about again. |
| **EDIT — the small line under the buttons** | Free while it is in beta · no card needed |
| **EDIT — the third question** | question: What happens after they sign up · answer: The next thing they will hear from you, and roughly when. |
| **EDIT — the third step** | number: 03 · title: The third step · line: What they have at the end that they did not have before. |
| **EDIT — the three nav links at the top** | nav1: What it does · nav1Target: section-lnFeatures · nav2: How it works · nav2Target: section-lnSteps · nav3: Price · nav3Target: section-lnPricing |
| **EDIT — the two prices, monthly and yearly** | states: monthly,yearly · values: freePrice,paidPrice,note,mBg,mFg,yBg,yFg · type-freePrice: string · type-paidPrice: string · type-note: string · type-mBg: color · type-mFg: color · type-yBg: color · type-yFg: color · value-monthly-freePrice: Free · value-yearly-freePrice: Free · value-monthly-paidPrice: The number, a month · value-yearly-paidPrice: The number, a year · value-monthly-note: Say what a month costs. If you have not decided, say “pricing when we launch”. · value-yearly-note: Say what a year costs, and what that saves against paying monthly. · value-monthly-mBg: var(--surface-raised) · value-yearly-mBg: transparent · value-monthly-mFg: var(--foreground) · value-yearly-mFg: var(--muted-foreground) · value-monthly-yBg: transparent · value-yearly-yBg: var(--surface-raised) · value-monthly-yFg: var(--muted-foreground) · value-yearly-yFg: var(--foreground) |
| **EDIT — What it does — heading** | Two things it does that nothing else does |
| **EDIT — what the yearly price actually saves them** |  |

### `Site/Contact`

| node | what it says today |
|---|---|
| **EDIT — the address the form sends to** | EDIT ME — you@example.com |

### `Site/Footer`

| node | what it says today |
|---|---|
| **EDIT — how to reach you** | Your phone number, your address, and when you are open. |
| **EDIT — the name in the footer** | Your name here |
| **EDIT — the small print** | © Your name · Your town. Delete this line or write your own. |

### `Site/Header`

| node | what it says today |
|---|---|
| **EDIT — your name, or the business’s** | Your name here |

### `Site/Switcher`

| node | what it says today |
|---|---|
| **EDIT — the look switcher (delete this strip before you publish)** | Three looks ship with this template. Keep the one you want, delete the other two pages, then delete this strip. |

---

*This file is generated from the template itself — the tables above are read out
of the shipped graph rather than typed, so they cannot describe a node that is
not there.*

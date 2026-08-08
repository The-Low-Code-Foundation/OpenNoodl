/**
 * AIX-009 — Seed templates for a project's `docs/` folder.
 *
 * These are prompts to a human, not content. Every heading asks a question the
 * graph cannot answer for itself: *why* this shape, *what* the third-party API
 * guarantees, *what* was rejected. Nothing here asks anyone to describe the
 * graph — Explain Mode narrates the live artifact on demand, and a prose copy
 * of it rots on the next node drag.
 *
 * @module ProjectDocs/templates
 */

import type { KnownDocKind } from './docsText';

const BRIEF = `# Brief

<!--
  What this app is, for whom, and what it deliberately is not.
  The assistant reads this on every build. Keep it short — a page at most.
-->

## What this app is

One or two sentences. What does it do, for whom?

## Who uses it

The people who will actually open this. What do they already know? What are
they trying to get done?

## Deliberately out of scope

The things this app is NOT going to do. This is the most useful section here —
it stops an assistant helpfully building something you decided against.
`;

const ARCHITECTURE = `# Architecture

<!--
  Reasons, contracts and decisions. NOT a node inventory: the graph is the spec,
  and Explain Mode narrates it on demand. If a sentence here would change when
  you drag a node, delete the sentence.
-->

## Page map

Which pages exist and what each is authoritative for. Where does a record get
created, and where is it only displayed?

## Data model

The collections/tables and the shape of a record. Why this shape and not the
obvious alternative.

## Backend contracts

External APIs and services this app depends on: what they guarantee, what they
do not, rate limits, auth, and what happens when they are down.

## Decisions

Significant choices and their reasoning. Longer ones get their own file under
\`docs/decisions/\`.
`;

const CONVENTIONS = `# Conventions

## How this file is used

The rules below are read by the assistant on **every authoring turn**, and they
outrank its own defaults. Editing this file changes what gets built.

Write rules that are checkable. "Make it nice" is not a rule; "every page's
outermost node is a Group named \`Page Root\`" is.

Lines marked **(example)** are placeholders showing the shape of a good rule.
They are *not* rules for this project: **ignore every line marked (example)** —
this instruction is addressed to the assistant as much as to you. Replace them
with your own rules, or delete them.

That matters because this file reaches the assistant verbatim. A project created
from a scoping conversation that agreed three pages would otherwise ship
carrying "(example) Do not add a Router; this app is a single page".

## Structure

- (example) Every page's outermost node is a Group named \`Page Root\`.
- (example) Shared UI goes under \`/Components/\`; pages go under \`/Pages/\`.

## Naming

- (example) Component names are Title Case; node labels say what the node is
  *for*, not what type it is.

## Styling

- (example) Never set a raw hex or px value where a design token exists.

## Data

- (example) All reads go through a Query Records node; never fetch in a
  Function node.

## What not to do

- (example) Do not add a Router; this app is a single page.
`;

export const DOC_TEMPLATES: Record<KnownDocKind, string> = {
  brief: BRIEF,
  architecture: ARCHITECTURE,
  conventions: CONVENTIONS
};

/**
 * BLD-007 — the seed for a document the user invented.
 *
 * It leads with the front matter because the front matter is the part that is
 * new and the part nobody would guess: the whole defect this closes is a doc
 * that looked finished and was never read. The prose under it says what a good
 * context doc contains, in the same voice as the three above — questions the
 * graph cannot answer for itself.
 */
export function newDocTemplate(options: { title: string; purpose?: string; inject: 'always' | 'pull' }): string {
  const hints =
    options.inject === 'pull'
      ? '\nwhen:   # words that should make the assistant reach for this — e.g. tax, pricing, invoices'
      : '';
  return `---
title:  ${options.title}
inject: ${options.inject}${hints}
---

# ${options.title}

${options.purpose?.trim() || 'What this document is for, in one sentence.'}

<!--
  ${
    options.inject === 'always'
      ? 'This document is sent with every build in this project. Keep it short and keep it true.'
      : 'The assistant fetches this when the task looks related. The `when:` hints above are how it decides.'
  }

  Good context is what the graph cannot say for itself: outside facts and rules
  (a tax rate, an API's quirks, a brand voice), decisions and what was rejected,
  and the things you would otherwise have to repeat in every prompt.

  Not a description of the graph — Explain Mode narrates the live version, and a
  prose copy of it is wrong by the next node drag.
-->
`;
}

# Conventions

## How this file is used

The rules below are read by the assistant on **every authoring turn**, and they
outrank its own defaults. Editing this file changes what gets built.

Write rules that are checkable. "Make it nice" is not a rule; "every page's
outermost node is a Group named `Page Root`" is.

Lines marked **(example)** are placeholders showing the shape of a good rule.
They are *not* rules for this project: **ignore every line marked (example)** —
this instruction is addressed to the assistant as much as to you. Replace them
with your own rules, or delete them.

That matters because this file reaches the assistant verbatim. A project created
from a scoping conversation that agreed three pages would otherwise ship
carrying "(example) Do not add a Router; this app is a single page".

## Structure

- (example) Every page's outermost node is a Group named `Page Root`.
- (example) Shared UI goes under `/Components/`; pages go under `/Pages/`.

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

## Established during scoping

> TODO: The scoping conversation did not establish any project-specific rules. The rules above are examples — replace them with rules that are checkable, or delete them.

_Source: `docs/decisions/000-initial-scope.md`._

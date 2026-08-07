# Conventions

<!--
  The rules the assistant must follow in this project. This file is read on
  every authoring turn and outranks the assistant's own defaults.

  Write rules that are checkable. "Make it nice" is not a rule; "every page's
  outermost node is a Group named Page Root" is.
-->

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

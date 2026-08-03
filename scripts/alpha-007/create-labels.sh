#!/usr/bin/env bash
#
# ALPHA-007 §6 / finding F72 — create the labels the issue forms already declare.
#
# ─────────────────────────────────────────────────────────────────────────────
#  NOT RUN AUTOMATICALLY. Read this before you run it.
# ─────────────────────────────────────────────────────────────────────────────
#
# The-Low-Code-Foundation/OpenNoodl is a **public** repository. Creating a label
# is a visible, permanent change to it, and the vocabulary below is a decision
# about how triage works — not a mechanical fix. It is Richard's call, not the
# script's. Nothing here was executed when it was written.
#
# What it fixes
# -------------
# All three issue forms declare `needs-triage`, and `node_report.yml` also
# declares `node-library`. **Neither label exists.** The repository still has
# GitHub's stock nine (`bug`, `documentation`, `duplicate`, `enhancement`,
# `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`) —
# verified with `gh label list` on 2026-08-03, unchanged since F72 was filed.
#
# GitHub **silently drops** a label it cannot resolve. It does not warn the
# reporter, it does not warn us, and the issue is simply created without it. So
# the queue contract in the spec — `gh issue list --label needs-triage` — has
# returned nothing since the forms were added, and will keep returning nothing,
# not because there are no reports but because the label does not exist. A queue
# that is empty by construction is worse than no queue: it reads as "nobody is
# reporting anything".
#
# Verify before and after:
#
#     gh label list  --repo The-Low-Code-Foundation/OpenNoodl
#     gh issue list  --repo The-Low-Code-Foundation/OpenNoodl --label needs-triage
#
# Both are read-only.
#
# The severity vocabulary
# -----------------------
# There was no severity anywhere before ALPHA-007 — no form field and no label —
# so the queue could only be ranked by date, which is the wrong axis. A blocker
# filed this morning outranks a cosmetic filed last month, and date ordering
# says the opposite.
#
# Four levels. Not the three of the spec's open question 1, because "high"
# collapses *blocks me* into *serious* and that is the only distinction which
# changes what a maintainer does today; and not five, because five asks a
# stranger to calibrate a scale they have never seen.
#
# Each label maps 1:1 onto an option of the `severity` dropdown in
# `bug_report.yml`, and onto a `slug` in
# `packages/noodl-editor/src/editor/src/utils/report/issueForm.ts`. Triage reads
# the `severity` key out of the report's JSON diagnostics fence and applies the
# matching label. **The reporter cannot apply it themselves** — a `labels=` URL
# parameter needs triage permission on the repository and a reporter is not a
# collaborator, which is exactly why severity is a form field.
#
# Colours: red → amber → yellow → grey, descending urgency. `needs-triage` is
# deliberately loud (it means "nobody has looked at this yet") and `triaged` is
# deliberately quiet.
#
# Usage
# -----
#     gh auth status                 # you, not a shared credential
#     bash scripts/alpha-007/create-labels.sh          # after it is agreed
#
# `--force` makes it idempotent: re-running updates colour and description
# rather than failing on a label that already exists.

set -euo pipefail

REPO="The-Low-Code-Foundation/OpenNoodl"

# ── The labels the forms already declare (F72) ───────────────────────────────

# Applied automatically by all three issue forms. The queue contract.
gh label create 'needs-triage' --repo "$REPO" --force \
  --color 'D93F0B' \
  --description 'Filed, nobody has looked at it yet. This is the queue.'

# Declared by node_report.yml.
gh label create 'node-library' --repo "$REPO" --force \
  --color '1D76DB' \
  --description 'A specific node: wrong behaviour, missing port, bad default.'

# ── Severity (ALPHA-007 §4) ──────────────────────────────────────────────────
# Applied by triage from the `severity` slug in the diagnostics fence.

gh label create 'severity:blocker' --repo "$REPO" --force \
  --color 'B60205' \
  --description 'The reporter cannot work around it. Ranks above everything.'

gh label create 'severity:serious' --repo "$REPO" --force \
  --color 'D93F0B' \
  --description 'There is a workaround, but it costs the reporter something.'

gh label create 'severity:annoying' --repo "$REPO" --force \
  --color 'FBCA04' \
  --description 'Wrong, but they can carry on.'

gh label create 'severity:cosmetic' --repo "$REPO" --force \
  --color 'C2E0C6' \
  --description 'Looks wrong, works fine.'

# ── Triage state ─────────────────────────────────────────────────────────────
# `needs-triage` is removed and `triaged` added when someone has read it and
# given it a severity. The claim itself is the **assignee** — native, visible on
# the list view, and needing no convention to be understood.

gh label create 'triaged' --repo "$REPO" --force \
  --color '0E8A16' \
  --description 'Read, severity assigned, ready to be picked up.'

gh label create 'needs-info' --repo "$REPO" --force \
  --color 'BFD4F2' \
  --description 'Waiting on the reporter. Not their fault — ask a specific question.'

gh label create 'cannot-reproduce' --repo "$REPO" --force \
  --color 'CFD3D7' \
  --description 'Tried, could not make it happen. Say what you tried before closing.'

echo
echo "Done. Verify with:"
echo "  gh label list --repo $REPO"
echo "  gh issue list --repo $REPO --label needs-triage"

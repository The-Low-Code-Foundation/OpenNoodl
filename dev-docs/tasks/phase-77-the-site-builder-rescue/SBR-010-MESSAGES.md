# SBR-010 — Messages

**Closes the loop the product leaves open.** The contact form stores records with an admin-only
ACL and nothing has ever read them back — someone fills in a form and the owner never learns.
🧭 Ruled in scope s1, as its own task (severable, but ruled in).

## 1. The person sentence

**A visitor's message reaches the owner's eyes: the owner opens Messages and reads it.**

## 2. Scope

- A **Messages** entry in the admin sidebar (SBR-006's shell), listing stored contact records:
  sender, email, message, received-at, newest first.
- An empty state in words ("No messages yet") — the states rule from the screens artifact: a
  surface that cannot answer must say so in a sentence a person can act on.
- Read-only list is the scope; reply/delete/mark-read are future and recorded as such (a
  deliberate deferral note — the live-preview lesson is that undocumented dropping is the one
  state a promise must not be in).

## 3. Acceptance criteria

1. **(person)** Submit the contact form as an anonymous visitor; sign in as owner; the message
   is on the Messages screen with its sender and time.
2. Anonymous cannot read messages (drive the refusal over real HTTP — the ACL is the feature).
3. Empty state shows its sentence; with rows, it doesn't (the pair).
4. The list is ordered newest-first and renders >1 message distinctly (For Each with a real
   interface — the placed-twice-renders-identically trap).

## 4. Traps

- The record shape is whatever `submitContactForm` stores today — read the cloud component
  first; don't invent a parallel class.
- 🔴 The admin-only ACL must be asserted on the DEPLOYED backend too (policy applies only when
  the backend starts with the project dir — SBR-001's machinery).

# Sanitise Email

Turns the address someone typed into the one you can store and compare: trimmed, lower-cased, unwrapped from a mailto: link or from the angle brackets a mail client pastes, with the domain split out and a validity flag beside it. Logic only, no UI — put it between a Text Input and whatever you save to, so two sign-ups for the same person are the same row.

## What installs

- `/Parts/Sanitise Email`

Place it by using `/Parts/Sanitise Email` as a node type.

## Notes from the author

Input: **Email**. Outputs: **Email** (the cleaned address), **Domain**, **Is Valid**.

The whole address is lower-cased, local part included. RFC 5321 makes the local part case-sensitive; no mail host anyone uses treats it that way, and lower-casing is what makes `Ada@Example.com` and `ada@example.com` the same account. If you need the address exactly as typed, keep the input as well as the output.

**Is Valid** is a shape check, not a deliverability check — it says the string could be an address, not that anyone reads it. Send a confirmation email; that is the only real test.

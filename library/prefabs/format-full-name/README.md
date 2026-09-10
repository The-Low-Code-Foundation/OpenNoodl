# Format Full Name

First name and last name into one display string, plus the initials an avatar needs. Handles the three cases a String Format node gets wrong: a missing surname leaves no trailing space, a single field holding "Ada Lovelace" still initials as AL, and an empty name falls back to whatever you pass. Logic only, no UI — wire Full Name into a Text node and Initials into an avatar.

## What installs

- `/Parts/Format Full Name`

Place it by using `/Parts/Format Full Name` as a node type.

## Notes from the author

Inputs: **First Name**, **Last Name**, **Fallback** (shown when there is no name at all — "Someone", "Deleted user"). Outputs: **Full Name**, **Initials**, **Has Name** (a boolean, for switching between the avatar image and the initials).

Names are trimmed before they are joined, so a stray space in a database column does not become a double space on screen. When only First Name is set and it contains a space, the last word is taken as the surname — that is the commonest real shape of this data, and it is why the initials come out `AL` rather than `A`.

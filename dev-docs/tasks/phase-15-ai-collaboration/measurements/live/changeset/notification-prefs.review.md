# Review — /Visual Components/Profile/Notification Preferences

_New component · 26 additions, 1 change · 0 cosmetic change(s) not shown_

AIX-003 criterion: a reader who has not seen this change should be able to say what
happened from this page alone. The request that produced it is deliberately in a
separate file (`<slug>.request.md`) — a spoiler at the top of the page would answer
the question the test is asking.

The bracketed "rejecting this also rejects …" notes are the change set's dependency
closure written out. The rail does not print them; it enforces them on click.

## Component (1)

- Changed componentType: (unset) → 'visual'

## Nodes (15)

- Added Component Inputs 'Current settings in' _(rejecting this also rejects 3 other change(s))_
- Added Component Outputs 'New settings out' _(rejecting this also rejects 4 other change(s))_
- Added Boolean 'Tracks whether any switch was touched' _(rejecting this also rejects 4 other change(s))_
- Added Group 'Card container' _(rejecting this also rejects 22 other change(s))_
- Added Text 'Card heading'
- Added Group 'Email row' _(rejecting this also rejects 5 other change(s))_
- Added Text 'Email label'
- Added Checkbox 'Email switch' _(rejecting this also rejects 3 other change(s))_
- Added Group 'Push row' _(rejecting this also rejects 5 other change(s))_
- Added Text 'Push label'
- Added Checkbox 'Push switch' _(rejecting this also rejects 3 other change(s))_
- Added Group 'Digest row' _(rejecting this also rejects 5 other change(s))_
- Added Text 'Digest label'
- Added Checkbox 'Digest switch' _(rejecting this also rejects 3 other change(s))_
- Added Button 'Save button' _(rejecting this also rejects 2 other change(s))_

## Wiring (11)

- Connected Component Inputs 'Current settings in'.email → Checkbox 'Email switch'.checked
- Connected Component Inputs 'Current settings in'.push → Checkbox 'Push switch'.checked
- Connected Component Inputs 'Current settings in'.digest → Checkbox 'Digest switch'.checked
- Connected Checkbox 'Email switch'.onChange → Boolean 'Tracks whether any switch was touched'.saveValue
- Connected Checkbox 'Push switch'.onChange → Boolean 'Tracks whether any switch was touched'.saveValue
- Connected Checkbox 'Digest switch'.onChange → Boolean 'Tracks whether any switch was touched'.saveValue
- Connected Boolean 'Tracks whether any switch was touched'.savedValue → Button 'Save button'.enabled
- Connected Checkbox 'Email switch'.checked → Component Outputs 'New settings out'.email
- Connected Checkbox 'Push switch'.checked → Component Outputs 'New settings out'.push
- Connected Checkbox 'Digest switch'.checked → Component Outputs 'New settings out'.digest
- Connected Button 'Save button'.onClick → Component Outputs 'New settings out'.Save

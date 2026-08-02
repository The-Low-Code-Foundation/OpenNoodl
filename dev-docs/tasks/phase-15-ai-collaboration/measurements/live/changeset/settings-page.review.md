# Review — /Pages/Account Settings

_New component · 39 additions, 1 change · 0 cosmetic change(s) not shown_

AIX-003 criterion: a reader who has not seen this change should be able to say what
happened from this page alone. The request that produced it is deliberately in a
separate file (`<slug>.request.md`) — a spoiler at the top of the page would answer
the question the test is asking.

The bracketed "rejecting this also rejects …" notes are the change set's dependency
closure written out. The rail does not print them; it enforces them on click.

## Component (1)

- Changed componentType: (unset) → 'page'

## Nodes (38)

- Added Group 'Page root' _(rejecting this also rejects 37 other change(s))_
- Added Group 'Header' _(rejecting this also rejects 4 other change(s))_
- Added Image 'Avatar'
- Added Group 'Name column' _(rejecting this also rejects 2 other change(s))_
- Added Text 'Member name'
- Added Text 'Header subtitle'
- Added Group 'Divider'
- Added Text 'Profile heading'
- Added Group 'Profile fields' _(rejecting this also rejects 3 other change(s))_
- Added Text Input 'Name input'
- Added Text Input 'Email input'
- Added Text Input 'Phone input'
- Added Group 'Divider'
- Added Text 'Notifications heading'
- Added Group 'Notifications rows' _(rejecting this also rejects 9 other change(s))_
- Added Group 'Email notif row' _(rejecting this also rejects 2 other change(s))_
- Added Text 'Email notif label'
- Added Checkbox 'Email notif checkbox'
- Added Group 'Push notif row' _(rejecting this also rejects 2 other change(s))_
- Added Text 'Push notif label'
- Added Checkbox 'Push notif checkbox'
- Added Group 'Digest row' _(rejecting this also rejects 2 other change(s))_
- Added Text 'Digest label'
- Added Checkbox 'Digest checkbox'
- Added Group 'Divider'
- Added Text 'Privacy heading'
- Added Group 'Privacy rows' _(rejecting this also rejects 5 other change(s))_
- Added Group 'Public profile row' _(rejecting this also rejects 2 other change(s))_
- Added Text 'Public profile label'
- Added Checkbox 'Public profile checkbox'
- Added Button 'Privacy policy link' _(rejecting this also rejects 1 other change(s))_
- Added Group 'Divider'
- Added Text 'Danger zone heading'
- Added Button 'Delete account button'
- Added Group 'Save/Cancel actions' _(rejecting this also rejects 2 other change(s))_
- Added Button 'Cancel button'
- Added Button 'Save button'
- Added External Link 'Open privacy policy' _(rejecting this also rejects 1 other change(s))_

## Wiring (1)

- Connected Button 'Privacy policy link'.onClick → External Link 'Open privacy policy'.do

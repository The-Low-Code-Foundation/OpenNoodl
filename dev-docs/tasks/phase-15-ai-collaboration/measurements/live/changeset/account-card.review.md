# Review — /Visual Components/Profile/Account Info Card

_Modification · 9 additions, 3 changes · 0 cosmetic change(s) not shown_

AIX-003 criterion: a reader who has not seen this change should be able to say what
happened from this page alone. The request that produced it is deliberately in a
separate file (`<slug>.request.md`) — a spoiler at the top of the page would answer
the question the test is asking.

The bracketed "rejecting this also rejects …" notes are the change set's dependency
closure written out. The rail does not print them; it enforces them on click.

## Nodes (5)

- Added Text 'Join Date' _(rejecting this also rejects 1 other change(s))_
- Added Group 'Change Password / Sign Out Row' _(rejecting this also rejects 3 other change(s))_
- Added Text 'Sign Out' _(rejecting this also rejects 1 other change(s))_
- Added Log Out 'Sign Out' _(rejecting this also rejects 1 other change(s))_
- Added Condition 'Has Date of Birth' _(rejecting this also rejects 2 other change(s))_

## Wiring (4)

- Connected User.prop-createdAt → Text 'Join Date'.text
- Connected Text 'Sign Out'.onClick → Log Out 'Sign Out'.login
- Connected User.prop-dob → Condition 'Has Date of Birth'.condition
- Connected Condition 'Has Date of Birth'.result → Group 'DOB Container'.visible

## Values (2)

- Changed Group (marginBottom: {"value":24,"unit":"px"} → {"value":8,"unit":"px"})
    - `marginBottom`: {"value":24,"unit":"px"} → {"value":8,"unit":"px"}
- Changed Text 'Change Password' (marginBottom: {"value":16,"unit":"px"} → (unset), marginTop: {"value":4,"unit":"px"} → (unset))
    - `marginBottom`: {"value":16,"unit":"px"} → (removed)
    - `marginTop`: {"value":4,"unit":"px"} → (removed)

## Layout (1)

- Moved Text 'Change Password' from Group into Group 'Change Password / Sign Out Row'

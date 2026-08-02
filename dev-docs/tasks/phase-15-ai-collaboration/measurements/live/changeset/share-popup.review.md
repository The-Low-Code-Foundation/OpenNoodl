# Review — /Pop-ups/Share/Share Popup

_Modification · 1 addition, 11 changes · 0 cosmetic change(s) not shown_

AIX-003 criterion: a reader who has not seen this change should be able to say what
happened from this page alone. The request that produced it is deliberately in a
separate file (`<slug>.request.md`) — a spoiler at the top of the page would answer
the question the test is asking.

The bracketed "rejecting this also rejects …" notes are the change set's dependency
closure written out. The rail does not print them; it enforces them on click.

## Nodes (5)

- Changed type of Text from Markdown to Text
- Changed type of Text from module.inlineHtml to Text
- Changed type of Text from module.inlineHtml to Text
- Changed type of Text from module.inlineHtml to Text
- Changed type of Text from module.inlineHtml to Text

## Wiring (3)

- Rewired Function 'generateMailTo'.out-result to feed Text.text (was module.inlineHtml.html)
- Rewired String Format.formatted to feed Text.text (was Markdown.source)
- Connected Group.onClick → Close Popup.close

## Values (4)

- Changed Group (cssClassName: (unset) → 'pointer')
    - `cssClassName`: (removed) → pointer
- Changed Text (html: '<div id="fb-root"></div>
<script asy…' → (unset), runJs: true → (unset))
    - `html`: <div id="fb-root"></div>
<script async defer crossorigin="anonymous" src="https://connect.facebook.net/sv_SE/sdk.js#… → (removed)
    - `runJs`: true → (removed)
- Changed Text (html: '<div 
    class="share-button" 
    d…' → (unset), runJs: true → (unset), text: (unset) → 'Facebook')
    - `html`: <div 
    class="share-button" 
    data-href="https://shinearticles.sandbox.noodl.app/article/&#123;slug&#125;" 
   … → (removed)
    - `runJs`: true → (removed)
    - `text`: (removed) → Facebook
- Changed Text (html: '<a 
    href="https://twitter.com/sha…' → (unset), runJs: true → (unset), text: (unset) → 'Twitter')
    - `html`: <a 
    href="https://twitter.com/share?ref_src=twsrc%5Etfw" 
    class="share-button" 
    data-text="Check out this… → (removed)
    - `runJs`: true → (removed)
    - `text`: (removed) → Twitter

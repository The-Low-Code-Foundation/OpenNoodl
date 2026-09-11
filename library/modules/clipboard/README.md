# Clipboard

Copy any text to the user's clipboard from your graph. No dependencies, no
network, no API keys.

## Nodes

### Copy To Clipboard (`nodegx.clipboard`)

| Port | Direction | Type | Description |
|---|---|---|---|
| Text | input | string | The text to copy. An unconnected input is treated as an empty string. |
| Copy | input | signal | Fire to perform the copy. |
| Success | output | signal | The text is on the clipboard. |
| Failure | output | signal | The copy was refused or unavailable. |
| Error | output | string | Human-readable failure message (empty on success). |

## How it copies

1. In secure contexts (https or localhost) it uses the async Clipboard API,
   `navigator.clipboard.writeText`.
2. On plain http, in older browsers, or when the async write is refused, it
   falls back to an off-screen readonly textarea plus
   `document.execCommand('copy')`.

If neither path is available, `Failure` fires and `Error` explains why.

## Notes

- Browsers gate clipboard writes behind a user gesture — wire `Copy` from a
  Button's `Click` (as the bundled **Clipboard Demo** component does), not from
  a timer or a page-load signal, or the browser may refuse the write.
- The demo component **Clipboard Demo** shows the wiring: a Button's `Click`
  fires `Copy`, `Success`/`Failure` drive a States node whose `currentState`
  feeds a status Text, and `Error` feeds a second Text.
- No post-install configuration is required.

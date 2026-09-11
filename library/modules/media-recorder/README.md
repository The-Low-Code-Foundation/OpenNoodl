# Media Recorder

Record audio or video in the browser and get a file you can upload. No
dependencies, no network, no API keys.

## Nodes

### Record Media (`nodegx.mediarecorder`)

| Port | Direction | Type | Description |
|---|---|---|---|
| Mode | input | enum | `Audio` or `Video`. Chooses the `getUserMedia` constraints and the container. Default `Audio`. |
| Media Stream | input | mediastream | Optional. Record this stream instead of opening a new one — wire the **Web Camera** node's `Media Stream` output here and the browser is not asked for permission twice. |
| Mime Type | input | string | Optional container override, e.g. `video/webm;codecs=vp8,opus`. Ignored if the browser does not support it. Leave empty to let the node pick. |
| Max Duration | input | number | Seconds. Above 0, the recording stops itself at this length. `0` (default) means no limit. |
| File Name | input | string | Optional name for the produced file. Defaults to `audio-<timestamp>.webm` / `video-<timestamp>.webm`. |
| Start | input | signal | Begin recording. Ignored while already recording. |
| Stop | input | signal | Finish the recording and publish the file. |
| Cancel | input | signal | Stop and discard — no file, no `Stopped`, and the device is released. |
| Started | output | signal | Recording has begun (permission was granted). |
| Stopped | output | signal | A recording finished and `File`, `Blob URL`, `Size` and `Duration` are set. |
| Permission Denied | output | signal | The user refused, or the page is not in a secure context. |
| Device Busy | output | signal | The microphone or camera is held by another application or tab. |
| No Device | output | signal | Nothing matching the requested constraints exists. |
| Failure | output | signal | Fires for **every** failure, including the three named above, so one catch-all wire is enough. It fires **before** the specific signal, so a graph that wires both sees the specific one land last. |
| Recording | output | boolean | True between `Started` and `Stopped`. |
| File | output | object | A `File` ready to hand to `Noodl.Files.upload`. |
| Blob URL | output | string | An object URL for the recording — wire it into a **Video** node's `Source`. |
| Recorded Mime Type | output | string | The container the browser actually used, which may not be the one requested. |
| Duration | output | number | Length in seconds, to one decimal. |
| Size | output | number | Size of the recording in bytes. |
| Error | output | string | Human-readable failure message; empty while things are fine. |

## What it does that a hand-rolled recorder usually does not

- **No base64 round trip.** The finished `Blob` becomes a `File` directly. Going
  via `FileReader.readAsDataURL` and back through `atob` — the usual recipe —
  holds two extra copies of the recording in memory as JavaScript strings, each
  about 1.37× the byte size, on the main thread.
- **Tracks are actually released.** `MediaRecorder.stop()` stops the *recorder*,
  not the *stream*. This node stops every track it opened on `Stop`, on
  `Cancel`, and when the node is unmounted — so navigating away mid-recording
  does not leave the camera light on.
- **Tracks it does not own are never stopped.** A stream arriving on `Media
  Stream` belongs to whoever created it; stopping those would black out a Web
  Camera preview that is still on screen.
- **A `Cancel` during the permission prompt is handled.** If the user answers
  after the node has been cancelled or unmounted, the arriving stream is stopped
  immediately rather than staying live with nothing holding a reference to it.
- **It survives a backgrounded tab.** Recording starts with a one-second
  timeslice, so chunks are flushed as they are produced rather than held in a
  single buffer, and the duration is measured from the wall clock — a
  backgrounded tab throttles timers, and a counted interval under-reports.

## Two things the drive found

Both were fixed here rather than written down as caveats, and both are the kind
of thing only a running browser shows:

- **`Failure` fires before the specific signal, not after.** Wiring `Failure` and
  `Permission Denied` to two branches of the same `States` node is the obvious
  thing to do, and with the specific signal first the generic one landed last
  and overwrote it — a refused prompt reported "Failed" and the "Denied" branch
  was dead on arrival.
- **A hidden group is not an unmounted node.** Setting a parent Group's
  `Mounted` to false removes the component from the page and leaves its
  non-visual nodes alive and recording. Only a route change deletes the node
  scope, which is what releases the device. If you need to stop a recording when
  a section is hidden, wire `Cancel` — do not rely on hiding it.

## Notes

- `getUserMedia` needs a **secure context**: https, or `localhost`. On plain
  http the node fires `Failure` with an explanatory `Error` rather than hanging.
- Browsers gate the permission prompt behind a user gesture — wire `Start` from
  a Button's `Click`, as the bundled **Media Recorder Demo** component does.
- Container support varies. The node probes `MediaRecorder.isTypeSupported` and
  falls back through webm → ogg → mp4; `Recorded Mime Type` reports what was
  actually used, so use that (not your requested value) when naming the upload.
- NodeGX has no dedicated Audio node, so the demo plays audio back through a
  **Video** node with `Controls` on. That works — `<video>` plays an audio-only
  file — and it keeps the demo free of any other module.
- This module sits **beside** `web-camera`, not inside it, and deliberately.
  `Web Camera` hands you a live stream to *show*; this hands you a file to
  *keep*, and it also covers audio, which `Web Camera` cannot do at all. The
  measurements behind that decision are in COM-005 §4b.

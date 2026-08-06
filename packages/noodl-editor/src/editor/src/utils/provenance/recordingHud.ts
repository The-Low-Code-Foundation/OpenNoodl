/**
 * HUD-001 — everything the recording overlay *says*, as pure functions.
 *
 * The overlay itself is a React component over the canvas, and React components are not
 * testable in this repo's editor suite (the specs are jasmine in Electron, and nothing renders
 * React). So the part that can be wrong lives here and `RecordingOverlay` only positions the
 * results — the same split `ProvenancePanel` has against `walkEngine`.
 *
 * Nothing here reaches for `TraceSession`: it takes numbers and returns sentences, which is
 * what makes the "recording, and nothing has happened yet" case — the one a placeholder would
 * quietly swallow — something a spec can hold onto.
 */

/** The live counter in the header. App-wide, because events arrive for the whole app. */
export function headerSummary(eventCount: number): string {
  return `${eventCount} event${eventCount === 1 ? '' : 's'}`;
}

/**
 * The second line, when the header alone would be ambiguous.
 *
 * ⚠️ **A count of zero is a result and has to look like one.** A recording that has captured
 * nothing yet and a HUD that failed to mount look identical on an untouched canvas, and the
 * user reading it has just pressed Record and clicked their app. Never a placeholder, never a
 * spinner: the number is live (the session polls every 1.5s whether or not any surface is
 * open, FH-011) so a live zero is the honest answer to "did my click do anything?".
 */
export function canvasNote(input: { recording: boolean; eventCount: number }): string | undefined {
  if (!input.recording) return undefined;
  if (input.eventCount === 0) {
    return 'Nothing has fired yet — use the app in the preview. This updates about once a second.';
  }
  return undefined;
}

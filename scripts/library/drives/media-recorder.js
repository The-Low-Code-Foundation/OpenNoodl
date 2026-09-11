#!/usr/bin/env node
/**
 * Does Record Media actually record — and does it let the device go afterwards?
 *
 * Both modes, five arms each, and the last three are the reason this file
 * exists. A recorder is easy to get right in the happy path and the ways it
 * goes wrong are all invisible in a screenshot: a refused prompt that reports
 * nothing, a device another tab is holding, and — worst — a recording abandoned
 * by navigation that leaves the microphone live with nothing left holding a
 * reference to it.
 *
 *   AC2  capture       fake device → Start → Stop → a blob with bytes in it
 *   AC3  denied        getUserMedia rejects NotAllowedError → Permission Denied
 *   AC3  busy          getUserMedia rejects NotReadableError → Device Busy
 *   AC3  navigate away mid-recording → every track ends
 *
 * The audio and video passes are the same graph with one parameter flipped,
 * which is the claim AC1 made when it chose one node over two library entries;
 * running both here is what keeps that claim honest.
 *
 * ## Three things about the instrument
 *
 * 🔴 **The fake device is a real capture path.** `--use-fake-device-for-media-stream`
 * gives Chrome a synthetic microphone and camera and
 * `--use-fake-ui-for-media-stream` auto-grants the prompt, so the happy arm runs
 * the genuine `getUserMedia` → `MediaRecorder` → `Blob` path rather than a stub
 * of it. Nothing here is mocked except the two failures, which cannot be
 * provoked any other way: a headless browser has no second application to hold
 * the microphone, and no human to click Block.
 *
 * 🔴 **"No live stream" is graded on the tracks, not on the code.** AC3 asks for
 * the camera indicator after navigation, which headless Chrome does not draw.
 * That indicator reflects exactly one thing — whether any `MediaStreamTrack` is
 * still `'live'` — so the drive wraps `getUserMedia`, keeps every track it ever
 * handed out, and reads `readyState` back after the page is gone. A drive that
 * instead grepped for `track.stop()` would pass on a recorder that calls it on a
 * stream it has already dropped, which is the bug worth catching.
 *
 * 🔴 **Teardown is driven by NAVIGATION, not by `mounted: false`.** The first
 * version used a Group's `mounted` input and measured a microphone still live
 * after the component vanished — correctly, as it turns out: hiding a group
 * removes its children from the DOM and leaves the component's non-visual nodes
 * alive and running. Only a route change deletes the page's node scope, which is
 * what calls `_onNodeDeleted`. The harness ships an `/Away` page for this.
 *
 * ⚠️ The cloud round trip is NOT driven. `Noodl.Files.upload` needs a live
 * backend, and the `file-upload` drive beside this one declines the same thing
 * for the same reason: a drive that faked it would assert nothing. What is
 * driven instead is the blob the node published — its byte count and its content
 * type — which is the File that `Upload File` would be handed.
 *
 * Run: node scripts/library/drives/media-recorder.js
 */
const path = require('path');
const { buildDriveProject, makeReporter, REPO_ROOT } = require('./harness');
const { withRenderedPage } = require(path.join(REPO_ROOT, 'scripts/devtools/render-report'));

/* Every track getUserMedia ever produced, kept alive past the node that owns it
   so its readyState can be read after teardown, plus a switch for forcing the
   two failures a headless browser cannot otherwise produce. */
const INSTALL_TRACK_SPY = `(() => {
  const md = navigator.mediaDevices;
  const real = md.getUserMedia.bind(md);
  window.__tracks = [];
  window.__forceError = null;
  md.getUserMedia = (c) => {
    if (window.__forceError) {
      return Promise.reject(new DOMException('forced by the drive', window.__forceError));
    }
    return real(c).then((s) => { window.__tracks.push(...s.getTracks()); return s; });
  };
  return 'installed';
})()`;

const READ = `JSON.stringify({
  texts: Array.from(document.querySelectorAll('*'))
    .filter((e) => !/^(SCRIPT|STYLE|TITLE|HEAD|NOSCRIPT)$/.test(e.tagName) &&
      e.childNodes.length === 1 && e.firstChild.nodeType === 3)
    .map((e) => e.textContent.trim()).filter((t) => t && t.length < 120),
  videoSrc: (document.querySelector('video') || {}).src || '',
  liveTracks: (window.__tracks || []).filter((t) => t.readyState === 'live').length,
  totalTracks: (window.__tracks || []).length
})`;

/* The recording itself, read back from the blob URL the node published. */
const MEASURE_BLOB = `(async () => {
  const el = document.querySelector('video');
  if (!el || !/^blob:/.test(el.src)) return JSON.stringify({ ok: false, why: 'no blob url' });
  const b = await fetch(el.src).then((r) => r.blob());
  return JSON.stringify({ ok: true, size: b.size, type: b.type });
})()`;

/* A Button's label may sit in a nested span, so the text match finds the label
   and the click climbs to the button that owns it — `disabled` lives there, and
   a disabled button swallows a click aimed at its child. */
const clickLabel = (s, label) =>
  s.evaluate(`(() => {
    const leaf = Array.from(document.querySelectorAll('*'))
      .find((e) => e.childNodes.length === 1 && e.firstChild.nodeType === 3 &&
        e.textContent.trim() === ${JSON.stringify(label)});
    if (!leaf) return 'not-found';
    const btn = leaf.closest('button, [role=button]') || leaf;
    if (btn.disabled) return 'disabled';
    const b = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) || btn;
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return 'ok';
  })()`);

async function drivePass(mode, r) {
  const tag = `[${mode}]`;
  const dir = buildDriveProject(
    'modules/media-recorder',
    {
      nodes: [
        { id: 'leave_btn', type: 'net.noodl.controls.button', onPage: true, parameters: { label: 'Leave' } },
        { id: 'go_away', type: 'RouterNavigate', parameters: { router: 'Main', target: '/Away' } }
      ],
      connections: [
        { sourceId: 'leave_btn', sourcePort: 'onClick', targetId: 'go_away', targetPort: 'navigate' }
      ]
    },
    (node) => {
      if (node.type === 'nodegx.mediarecorder') node.parameters = { ...node.parameters, mode };
    }
  );

  await withRenderedPage(
    {
      projectDir: dir,
      chromeArgs: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
    },
    async (s) => {
      await s.setViewport({ width: 1280, height: 900 });
      const read = async () => JSON.parse(await s.evaluate(READ));
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));

      /* ⚠️ Fixed sleeps do not work here. The fake device takes between one and
         three seconds to hand over its first track in headless Chrome, which is
         long enough that a 1.6s sleep read the status BEFORE recording started
         and then graded every later arm one step out of phase — the first
         version of this drive failed nine checks for that reason alone, and not
         one of them was about the recorder. Poll for the condition instead. */
      const until = async (label, pred, ceilingMs = 20000) => {
        const deadline = Date.now() + ceilingMs;
        let last;
        while (Date.now() < deadline) {
          last = await read();
          if (pred(last)) return last;
          await wait(200);
        }
        console.log(`  (timed out waiting for ${label} after ${ceilingMs}ms)`);
        return last;
      };

      await s.evaluate(INSTALL_TRACK_SPY);

      const before = await read();
      r.check(`${tag} no track is live at rest`, before.liveTracks === 0, `${before.liveTracks} live`);

      // ── AC2: a real capture through the fake device ────────────────────────
      r.check(`${tag} Record is clickable`, (await clickLabel(s, 'Record')) === 'ok');
      // ⚠️ Both halves, not just the track. The track goes live the moment
      // getUserMedia resolves, one beat BEFORE the node publishes `Started` —
      // polling on the track alone read the status as still "Ready".
      const during = await until('the recording to start', (v) => v.liveTracks >= 1 && v.texts.includes('Recording'));
      r.check(`${tag} a track went live`, during.liveTracks >= 1, `${during.liveTracks} live / ${during.totalTracks}`);
      r.check(`${tag} status says Recording`, during.texts.includes('Recording'), during.texts.join(' | ').slice(0, 80));

      await wait(1200); // give the recorder something to actually capture
      r.check(`${tag} Stop is enabled while recording`, (await clickLabel(s, 'Stop')) === 'ok');
      const after = await until('the file to be published', (v) => /^blob:/.test(v.videoSrc));
      r.check(`${tag} status leaves Recording`, !after.texts.includes('Recording'), after.texts.join(' | ').slice(0, 80));
      r.check(`${tag} a blob URL reached the player`, /^blob:/.test(after.videoSrc), after.videoSrc.slice(0, 36) || '(no src)');
      r.check(`${tag} no track is left live after Stop`, after.liveTracks === 0, `${after.liveTracks} live / ${after.totalTracks}`);

      const blob = JSON.parse(await s.evaluate(MEASURE_BLOB));
      r.check(`${tag} the recording has bytes`, blob.ok && blob.size > 0, blob.ok ? `${blob.size} bytes` : blob.why);
      r.check(
        `${tag} the recording carries a ${mode} content type`,
        blob.ok && new RegExp(`^${mode}/`).test(blob.type),
        blob.type || '(none)'
      );

      // ── AC3: permission denied ─────────────────────────────────────────────
      const tracksBefore = after.totalTracks;
      await s.evaluate(`window.__forceError = 'NotAllowedError'`);
      await clickLabel(s, 'Record');
      const denied = await until('the denial to land', (v) => v.texts.includes('Denied'), 8000);
      r.check(`${tag} permission denial reaches a port`, denied.texts.includes('Denied'), denied.texts.join(' | ').slice(0, 80));
      r.check(
        `${tag} a denied prompt opens no track`,
        denied.totalTracks === tracksBefore && denied.liveTracks === 0,
        `${denied.liveTracks} live / ${denied.totalTracks}`
      );

      // ── AC3: device busy ───────────────────────────────────────────────────
      await s.evaluate(`window.__forceError = 'NotReadableError'`);
      await clickLabel(s, 'Record');
      const busy = await until('the busy device to land', (v) => v.texts.includes('Busy'), 8000);
      r.check(`${tag} a busy device reaches its own port`, busy.texts.includes('Busy'), busy.texts.join(' | ').slice(0, 80));

      // ── AC3: navigate away mid-recording ───────────────────────────────────
      await s.evaluate(`window.__forceError = null`);
      await clickLabel(s, 'Record');
      const rec2 = await until('the second recording to start', (v) => v.liveTracks >= 1);
      r.check(`${tag} recording again before the teardown arm`, rec2.liveTracks >= 1, `${rec2.liveTracks} live`);

      r.check(`${tag} Leave is clickable`, (await clickLabel(s, 'Leave')) === 'ok');
      const gone = await until('the route change', (v) => v.texts.includes('Away'), 8000);
      r.check(`${tag} the route really changed`, gone.texts.includes('Away'), gone.texts.join(' | ').slice(0, 80));
      const released = await until('the tracks to end', (v) => v.liveTracks === 0, 6000);
      r.check(
        `${tag} navigating away mid-recording ends every track`,
        released.liveTracks === 0,
        `${released.liveTracks} live / ${released.totalTracks}`
      );
    }
  );
}

(async () => {
  const r = makeReporter();
  // Serial: each pass starts its own headless Chrome, and running two at once on
  // a dev box competes with whatever else holds the CPU.
  await drivePass('audio', r);
  await drivePass('video', r);
  r.finish();
})();

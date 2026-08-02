#!/usr/bin/env node
/**
 * Phase 15 — the scripted, no-provider authoring session.
 *
 * `harness.ts` runs the authoring loop *headlessly* against a real provider.
 * This runs it *in the running editor* against **no provider at all**: a
 * recorded candidate is replayed into `AiClient.chatStream` as a
 * `submit_component` tool call, and everything downstream of the network — the
 * Build panel, `AuthoringSession`, the SUB-006 validation gate, the preview
 * document, `AppRegistry`'s document path — is the app's own code, untouched.
 *
 * It exists because the panel surfaces of AIX-003 (the change-review document),
 * AIX-008 (the preview sandbox) and AIX-011 could not be smoke-tested without
 * either spending provider money or mounting a React component by hand. The
 * hand-mounting was tried on 2026-08-02 and `ChangeReviewDocument` rendered
 * nothing — unsurprisingly, since it normally arrives through a document
 * provider that ad-hoc mounting bypasses. Staging a real candidate and pressing
 * the real button is both cheaper and more honest.
 *
 * The seam is deliberately the *provider boundary* and nothing else. `AiClient`
 * is a plain object literal (`export const AiClient = {...}`), so two of its
 * properties can be replaced at runtime:
 *
 *   - `chatStream`  — replays the recorded submission, streaming its arguments
 *                     in chunks so the preview canvas's partial-payload scanner
 *                     runs exactly as it does for a live model;
 *   - `isConfigured` — so the panel enables its button with no API key present.
 *                      Nothing can leak to a provider: there is no key to use.
 *
 * `AuthoringSession` resolves `AiClient.chatStream` at call time (inside an
 * arrow function), so the patch also takes effect on sessions already built.
 *
 * Usage (editor must be running via `npm run dev:debug`):
 *
 *   node packages/noodl-editor/scripts/aix15-live/scripted-session.js \
 *     --candidate=account-card [--project=<dir>] [--json]
 *
 * `--candidate` names a recording under
 * `dev-docs/tasks/phase-15-ai-collaboration/measurements/live/changeset/`
 * (`<slug>.candidate.json` plus `<slug>.request.md`), or is a path to any
 * `ComponentFiles` JSON.
 *
 * `--project` is a directory to open first. **Point it at a copy**: the editor
 * rewrites and minifies a project it opens, and the corpus these candidates
 * were authored against is a tracked test fixture
 * (`packages/noodl-editor/tests/testfs/git-repo-utf8`). `--copy-corpus` does the
 * copying for you.
 *
 * On success the Build panel holds a staged candidate and the change-review
 * document is open, reached the way a user reaches it. What the script prints
 * is what it *measured*, not what it attempted.
 *
 * `--smoke` additionally drives AIX-003's slices 4 and 5 — the view toggle, the
 * walkthrough, exclude/restore and their dependency closures, and Accept N of M.
 * It **accepts, and accepting writes**: a second `--smoke` of the same candidate
 * against the same project finds nothing left to diff. Use a fresh
 * `--copy-corpus` per smoke run.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, elementCentre, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CHANGESET_DIR = path.join(
  REPO_ROOT,
  'dev-docs/tasks/phase-15-ai-collaboration/measurements/live/changeset'
);
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

/* -------------------------------------------------------------------------- */
/* Recording → submission                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Invert `buildCandidate`: the three v2 files back into `submit_component`
 * arguments.
 *
 * The submit contract is deliberately *narrower* than the candidate it
 * produces, so this drops rather than invents. `children` is derived by
 * `buildCandidate` from submission order and `parent`, and the fields in
 * `CARRIED_NODE_FIELDS` (`variant`, `stateParameters`, `dynamicports`, …) are
 * carried over from the base component — a model cannot express them and
 * neither should a replay. Sending them back would be a *different* submission
 * from the one that was recorded.
 *
 * Correctness is not asserted here. It is checked by the editor: the real gate
 * either passes this or does not, and the staged result is compared against the
 * recording afterwards (`verifyStaged`).
 */
function toSubmitArgs(files) {
  const nodes = (files.nodes?.nodes ?? []).map((node) => {
    const submitted = { id: node.id, type: node.type };
    if (node.label !== undefined) submitted.label = node.label;
    if (node.x !== undefined) submitted.x = node.x;
    if (node.y !== undefined) submitted.y = node.y;
    if (node.parent !== undefined) submitted.parent = node.parent;
    if (node.parameters !== undefined) submitted.parameters = node.parameters;
    if (node.ports !== undefined) submitted.ports = node.ports;
    return submitted;
  });

  const args = { nodes };
  const connections = files.connections?.connections ?? [];
  if (connections.length > 0) {
    args.connections = connections.map((c) => ({
      fromId: c.fromId,
      fromProperty: c.fromProperty,
      toId: c.toId,
      toProperty: c.toProperty,
      ...(c.label !== undefined ? { label: c.label } : {})
    }));
  }
  if (Array.isArray(files.nodes?.visualRoots)) args.visual_roots = files.nodes.visualRoots;
  if (typeof files.component?.description === 'string') args.description = files.component.description;
  if (files.sampleData) args.sample_data = files.sampleData;
  return args;
}

/**
 * Mirrors `isExcludable` in `ChangeReviewDocument.tsx`. Kept as a literal copy
 * rather than an import because this script must run against a *built* editor
 * without compiling its TypeScript — so if that rule changes, this row count
 * goes red, which is the correct outcome for a check that has drifted.
 */
function isExcludableKind(change) {
  return change.kind !== 'component-renamed' && change.kind !== 'component-metadata-changed';
}

/** Load `<slug>.candidate.json` + `<slug>.request.md`, or an explicit path. */
function loadRecording(candidate) {
  const asPath = path.isAbsolute(candidate) ? candidate : path.join(REPO_ROOT, candidate);
  const file = fs.existsSync(asPath) ? asPath : path.join(CHANGESET_DIR, `${candidate}.candidate.json`);
  if (!fs.existsSync(file)) throw new Error(`No recorded candidate at ${file}`);

  const files = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!files.component || !files.nodes) {
    throw new Error(`${file} is not a ComponentFiles recording (expected { component, nodes, connections })`);
  }

  // The request is prose the user typed; it decides nothing here (the reply is
  // fixed) but it is what the panel and the review title show, so a smoke that
  // used a made-up sentence would be showing something no run ever produced.
  const requestFile = file.replace(/\.candidate\.json$/, '.request.md');
  const request = fs.existsSync(requestFile) ? fs.readFileSync(requestFile, 'utf8').trim() : '';
  const description = requestFile === file ? '' : firstParagraph(request);

  // `component.path` is the authoritative target: `/Pages/Account Settings` in
  // the recording is `Pages/Account Settings` in the panel's Component field.
  const componentPath = String(files.component.path ?? files.component.name ?? '').replace(/^\/+/, '');

  // The change set the same candidate produced against the same base, recorded
  // alongside it. Same base + same candidate must diff to the same thing, so a
  // divergence here is a real regression in the diff or the adapter — which is
  // what turns this script from a stager into a check.
  const changesFile = file.replace(/\.candidate\.json$/, '.changes.json');
  const recordedChanges = fs.existsSync(changesFile) ? JSON.parse(fs.readFileSync(changesFile, 'utf8')) : null;

  return {
    file,
    files,
    componentPath,
    description,
    request,
    expected: {
      nodes: files.nodes?.nodes?.length ?? 0,
      connections: files.connections?.connections?.length ?? 0,
      changes: recordedChanges ? recordedChanges.changes.length : null,
      // The rail offers an exclude control per change *except* the
      // component-level ones — those are the proposal's identity, not a part of
      // it. Comparing rows against the total change count would be off by one
      // on every proposal that renames or re-describes its component.
      excludable: recordedChanges ? recordedChanges.changes.filter(isExcludableKind).length : null,
      isNewComponent: recordedChanges ? recordedChanges.isNewComponent : null
    }
  };
}

/**
 * The request files are Markdown: a heading, then the ask quoted verbatim as a
 * blockquote. The `>` markers are presentation — what the user typed is what
 * goes back into the panel's field.
 */
function firstParagraph(markdown) {
  const body = markdown
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .map((line) => line.replace(/^\s*>\s?/, ''))
    .join('\n')
    .trim();
  return body.split(/\n\s*\n/)[0].trim();
}

/* -------------------------------------------------------------------------- */
/* Renderer-side helpers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Webpack's `__webpack_require__`, captured by pushing an empty chunk. Module
 * ids are source-relative paths. Verified harmless (see the CDP trap notes);
 * eval scope is shared between calls, so everything here stays inside an IIFE.
 */
const PROBE = `(() => {
  if (!window.__aix15wr) {
    window.webpackChunknoodl_editor.push([['aix15-scripted'], {}, (r) => (window.__aix15wr = r)]);
  }
  return typeof window.__aix15wr === 'function';
})()`;

const REQ = (id) => `window.__aix15wr(${JSON.stringify(id)})`;

const AI_CLIENT_MODULE = './src/editor/src/models/AiAssistant/client/AiClient.ts';
const STYLE_LINT_MODULE = './src/editor/src/models/AiAssistant/authoring/styleLint.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';
const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';

/**
 * Install the scripted reply.
 *
 * The reply is the same every turn, which is the point: a recorded submission
 * that passed the gate once should pass it again, and a session that needs a
 * second turn is telling us the *editor's* context differs from the harness's.
 * `usage` is all zeroes and `costUsd` is 0 — this session costs nothing, and a
 * cost readout that claimed otherwise would be a lie in a measurement tool.
 */
function installScript(args, chunkCount) {
  return `(async () => {
    const mod = ${REQ(AI_CLIENT_MODULE)};
    const AiClient = mod.AiClient;
    if (!AiClient) return { ok: false, error: 'AiClient not found on ' + ${JSON.stringify(AI_CLIENT_MODULE)} };

    const args = ${JSON.stringify(args)};
    const argsText = JSON.stringify(args);
    window.__aix15 = window.__aix15 || {};
    window.__aix15.calls = 0;

    if (!window.__aix15.original) {
      window.__aix15.original = { chatStream: AiClient.chatStream, isConfigured: AiClient.isConfigured };
    }

    AiClient.isConfigured = () => true;
    AiClient.chatStream = async (request, callbacks = {}) => {
      window.__aix15.calls++;
      // Stream the arguments the way a provider does, so the preview canvas's
      // PartialPayloadScanner runs the same code path it runs live.
      const chunks = ${chunkCount};
      for (let i = 0; i < chunks; i++) {
        const upto = Math.floor((argsText.length * (i + 1)) / chunks);
        callbacks.onToolCallPartial?.({ index: 0, name: 'submit_component', argsText: argsText.slice(0, upto) });
        await new Promise((r) => setTimeout(r, 10));
      }
      const toolCall = { id: 'scripted-' + window.__aix15.calls, name: 'submit_component', arguments: args };
      callbacks.onToolCall?.(toolCall);
      callbacks.onEnd?.();
      return {
        text: '',
        toolCalls: [toolCall],
        usage: { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
        model: 'scripted-replay',
        stopReason: 'tool_calls'
      };
    };
    return { ok: true, nodes: args.nodes.length, connections: (args.connections || []).length };
  })()`;
}

/* -------------------------------------------------------------------------- */
/* Driving                                                                    */
/* -------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 30000, every = 400, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what} (last value: ${JSON.stringify(last)})`);
}

/** A real trusted click, resolved by selector at the moment of clicking. */
async function click(client, selector) {
  const box = await elementCentre(client, selector);
  await dispatchClick(client, box);
}

/**
 * Click the first button whose visible text matches. The review document and
 * the Build panel have no test ids, and CSS-module class names are hashed —
 * text is what a reviewer actually reads, so it is what this matches on.
 * Tagging and clicking happen in one eval because a React re-render between two
 * CDP calls drops the tag (a documented trap).
 */
async function clickButtonWithText(client, text, { scope = 'body' } = {}) {
  const box = await evaluate(
    client,
    `(() => {
       const root = document.querySelector(${JSON.stringify(scope)});
       if (!root) return null;
       const buttons = Array.from(root.querySelectorAll('button, [role=button]'));
       const el = buttons.find((b) => (b.innerText || '').trim().toLowerCase() === ${JSON.stringify(text)}.toLowerCase())
         || buttons.find((b) => (b.innerText || '').trim().toLowerCase().startsWith(${JSON.stringify(text)}.toLowerCase()));
       if (!el) return null;
       el.scrollIntoView({ block: 'center', inline: 'center' });
       const r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height, label: (el.innerText || '').trim() };
     })()`
  );
  if (!box) throw new Error(`no button reading "${text}"`);
  // A hidden panel's elements have a zero-sized box and the click would land
  // somewhere else entirely while reporting success.
  if (!box.width || !box.height) throw new Error(`button "${text}" has a zero-sized box — is its panel hidden?`);
  await dispatchClick(client, box);
  return box.label;
}

/** Open a project by stubbing the native folder picker and pressing the real button. */
async function openProject(client, dir) {
  const already = await evaluate(
    client,
    `(() => {
       const m = ${REQ(PROJECT_MODULE)};
       const p = m.ProjectModel && m.ProjectModel.instance;
       return p ? (p._retainedProjectDirectory || '') : '';
     })()`
  );
  if (already && path.resolve(already) === path.resolve(dir)) return { opened: false, dir: already };
  if (already) throw new Error(`a different project is already open (${already}) — close it first`);

  // CDP cannot click a native dialog; stubbing the picker is the documented way
  // through, and it keeps the click itself real.
  await evaluate(
    client,
    `(() => {
       const platform = ${REQ(PLATFORM_MODULE)};
       platform.filesystem.openDialog = async () => ${JSON.stringify(dir)};
       return true;
     })()`
  );
  await clickButtonWithText(client, 'Open project');
  await waitFor(
    client,
    `(() => {
       const m = ${REQ(PROJECT_MODULE)};
       return !!(m.ProjectModel && m.ProjectModel.instance);
     })()`,
    { timeoutMs: 60000, what: 'the project to open' }
  );
  return { opened: true, dir };
}

/**
 * How many turns this candidate *should* take.
 *
 * AIX-006 gives a candidate whose style lint finds raw values one advisory pass:
 * the submission passes the gate, the agent is asked once to make it on-system,
 * and it submits again. A replay answers identically both times, so a recorded
 * candidate with findings legitimately takes two turns and one without takes
 * one. Asserting "one turn" flatly would have reported correct behaviour as a
 * failure — it did, on the first run of this script.
 *
 * The lint is run through the editor's own module against the *open* project's
 * tokens, because that is what the session lints against.
 */
async function expectedTurns(client, files) {
  const findings = await evaluate(
    client,
    `(() => {
       const m = ${REQ(STYLE_LINT_MODULE)};
       return m.styleLintCandidate(${JSON.stringify(files)}).findings;
     })()`
  );
  return { turns: findings.length > 0 ? 2 : 1, styleFindings: findings };
}

/** Bring up the Build panel through the sidebar model — never by rail index. */
async function openBuildPanel(client) {
  return evaluate(
    client,
    `(() => {
       const m = ${REQ(SIDEBAR_MODULE)};
       m.SidebarModel.instance.switch('ai-authoring');
       return true;
     })()`
  );
}

/**
 * Fill the Build panel and press its real button, then wait for the session to
 * stage. Every step is the user's step; only the reply is scripted.
 */
/**
 * Return the panel to its form.
 *
 * A staged session replaces the Component/description fields with the activity
 * feed, so a second run has nothing to fill in. Rejecting is the user's way
 * back and it writes nothing — which is also worth exercising, since "reject
 * leaves the project untouched" is a claim the panel makes.
 */
async function reset(client) {
  const state = await evaluate(
    client,
    `(() => {
       const text = document.body.innerText || '';
       return {
         review: /Click a change to see it on the canvas/.test(text),
         session: /Staged: |Submitted — |Start over/.test(text),
         // After an accept the panel shows its confirmation instead of the
         // form, and "Reject" is not on it — a previous smoke run leaves the
         // panel here, so the next one has to know the way out.
         accepted: /Build another/.test(text)
       };
     })()`
  );
  if (!state.review && !state.session && !state.accepted) return { reset: false };

  // "Reject" exists on both the panel and the review document and means the
  // same thing; the document's copy routes to the panel's own handler.
  await clickButtonWithText(client, state.accepted ? 'Build another' : 'Reject');
  await waitFor(
    client,
    `(() => {
       const inputs = Array.from(document.querySelectorAll('input')).filter((el) => /Pages\\//i.test(el.placeholder || ''));
       return inputs.length > 0 ? true : null;
     })()`,
    { timeoutMs: 15000, what: 'the Build panel to return to its form' }
  );
  return { reset: true };
}

async function stage(client, { componentPath, description }) {
  await openBuildPanel(client);
  await sleep(600);
  await reset(client);

  // The Component field and the description are the only two inputs the panel
  // shows before a session exists, and they are labelled rather than tagged.
  const filled = await evaluate(
    client,
    `(() => {
       const inputs = Array.from(document.querySelectorAll('input[type=text], input:not([type]), textarea'))
         .filter((el) => el.getBoundingClientRect().width > 0);
       return inputs.map((el, i) => ({ i, tag: el.tagName, placeholder: el.placeholder || '' }));
     })()`
  );
  const componentField = filled.find((f) => f.tag === 'INPUT' && /Pages\//i.test(f.placeholder));
  const descriptionField = filled.find((f) => f.tag === 'TEXTAREA');
  if (!componentField || !descriptionField) {
    throw new Error(`the Build panel is not showing its form (found: ${JSON.stringify(filled)})`);
  }

  const pick = (index) =>
    `Array.from(document.querySelectorAll('input[type=text], input:not([type]), textarea')).filter((el) => el.getBoundingClientRect().width > 0)[${index}]`;

  for (const [index, value] of [
    [componentField.i, componentPath],
    [descriptionField.i, description]
  ]) {
    const ok = await evaluate(
      client,
      `(() => {
         const el = ${pick(index)};
         if (!el) return false;
         const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
         Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
         el.dispatchEvent(new Event('input', { bubbles: true }));
         return true;
       })()`
    );
    if (!ok) throw new Error('the Build panel form disappeared between reads');
  }
  await sleep(400);

  // "Update it" for an existing component, "Build it" for a new one — the panel
  // decides which, and the label is the evidence of what it decided.
  const label = await evaluate(
    client,
    `(() => {
       const b = Array.from(document.querySelectorAll('button')).find((el) => /^(Update it|Build it)$/.test((el.innerText || '').trim()));
       return b ? (b.innerText || '').trim() : null;
     })()`
  );
  if (!label) throw new Error('neither "Build it" nor "Update it" is on screen — is a project open?');
  await clickButtonWithText(client, label);

  const staged = await waitFor(
    client,
    `(() => {
       const text = document.body.innerText || '';
       const m = text.match(/Staged: (\\S[^\\n]*?) — (\\d+) nodes?, (\\d+) connections?/);
       return m ? { legacyName: m[1], nodes: Number(m[2]), connections: Number(m[3]) } : null;
     })()`,
    { timeoutMs: 60000, what: 'the candidate to stage' }
  );

  const calls = await evaluate(client, `window.__aix15.calls`);
  return { mode: label === 'Update it' ? 'update' : 'create', staged, turns: calls };
}

/**
 * Open every collapsed group in the rail.
 *
 * Past 20 changes the document starts its groups collapsed — sensible for a
 * reader, and a trap for a probe: the rows are not in the DOM at all, so
 * counting exclude controls on a large proposal reports **zero** and looks
 * exactly like a rail that has lost its controls. That is precisely what the
 * first run of this script reported for the two largest recordings.
 *
 * Each header is re-resolved after every click because the rail re-renders and
 * a handle taken before the click can point at a different button after it.
 */
async function expandGroups(client, limit = 12) {
  const opened = [];
  for (let i = 0; i < limit; i++) {
    const box = await evaluate(
      client,
      `(() => {
         const headers = Array.from(document.querySelectorAll('button'))
           .filter((b) => (b.className || '').toString().includes('GroupHeader'));
         const collapsed = headers.filter((h) => !h.nextElementSibling || h.nextElementSibling.children.length === 0);
         const el = collapsed[0];
         if (!el) return null;
         el.scrollIntoView({ block: 'center' });
         const r = el.getBoundingClientRect();
         return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: (el.innerText || '').trim().split('\\n')[0] };
       })()`
    );
    if (!box) break;
    await dispatchClick(client, box);
    opened.push(box.label);
    await sleep(350);
  }
  return opened;
}

/** Press "Review changes" — the same button, opening the same document. */
async function openReview(client) {
  await clickButtonWithText(client, 'Review changes');
  await waitFor(
    client,
    `(() => /Click a change to see it on the canvas/.test(document.body.innerText || '') || null)()`,
    { timeoutMs: 20000, what: 'the change-review document to open' }
  );
  const expanded = await expandGroups(client);
  const opened = await waitFor(
    client,
    `(() => {
       const text = document.body.innerText || '';
       if (!/Click a change to see it on the canvas/.test(text)) return null;
       const buttons = Array.from(document.querySelectorAll('button')).map((b) => (b.innerText || '').trim());
       const accept = buttons.find((b) => /^Accept /.test(b));
       // The summary is the line immediately above the rail's instruction — a
       // looser match picks up the "Review changes" button instead.
       const lines = text.split('\\n').map((s) => s.trim()).filter(Boolean);
       const at = lines.findIndex((l) => /^Click a change to see it on the canvas/.test(l));
       const summary = at > 0 ? lines[at - 1] : null;
       return {
         accept: accept || null,
         summary: summary ? summary.trim() : null,
         hasBefore: buttons.includes('Before'),
         hasAfter: buttons.includes('After'),
         hasWalkthrough: buttons.includes('Walk through'),
         excludeButtons: document.querySelectorAll('[aria-label="Exclude this change"]').length
       };
     })()`,
    { timeoutMs: 20000, what: 'the change rail to render its rows' }
  );
  return { ...opened, expandedGroups: expanded };
}

/* -------------------------------------------------------------------------- */
/* The slice-4/5 UI smoke                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A full-window screenshot, hashed. The review canvas is Canvas2D — its nodes
 * are painted pixels, not DOM — so "did Before actually render something
 * different from After" is not a question the DOM can answer. Comparing what
 * the compositor produced is the only honest way to ask it.
 */
async function frameHash(client) {
  const shot = await client.send('Page.captureScreenshot', { format: 'png' });
  return require('crypto').createHash('sha1').update(shot.data).digest('hex').slice(0, 12);
}

/** The rail's current state, as a reviewer would read it off the screen. */
function railStateExpr() {
  return `(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const accept = buttons.find((b) => /^Accept /.test((b.innerText || '').trim()));
    return {
      accept: accept ? (accept.innerText || '').trim() : null,
      excluded: document.querySelectorAll('[aria-label="Include this change again"]').length,
      kept: document.querySelectorAll('[aria-label="Exclude this change"]').length,
      prevDisabled: (() => {
        const p = buttons.find((b) => (b.innerText || '').trim() === 'Previous');
        return p ? p.disabled === true || p.getAttribute('aria-disabled') === 'true' : null;
      })(),
      walkLabel: (() => {
        const w = buttons.find((b) => /^(Walk through|Next)$/.test((b.innerText || '').trim()));
        return w ? (w.innerText || '').trim() : null;
      })()
    };
  })()`;
}

/** Click the nth exclude (or restore) control, resolved at click time. */
async function clickRailControl(client, label, index = 0) {
  const box = await evaluate(
    client,
    `(() => {
       const els = Array.from(document.querySelectorAll('[aria-label=${JSON.stringify(label)}]'));
       const el = els[${index}];
       if (!el) return null;
       el.scrollIntoView({ block: 'center' });
       const r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
     })()`
  );
  if (!box) throw new Error(`no "${label}" control at index ${index}`);
  if (!box.width || !box.height) throw new Error(`"${label}" at index ${index} has a zero-sized box`);
  await dispatchClick(client, box);
  await sleep(400);
}

/**
 * AIX-003 slices 4 and 5, through the real document: the view toggle, the
 * walkthrough stepper, per-row exclude and restore with their dependency
 * closures, and Accept N of M landing in the project.
 *
 * Every step records what it *measured*. A step that cannot be measured says so
 * rather than reporting the click it managed to dispatch.
 */
async function smoke(client, expected) {
  const steps = [];
  const record = (name, ok, detail) => steps.push({ name, ok, detail });

  // --- The view toggle. Three renders of the same graph; three distinct frames.
  const frames = {};
  for (const [label, key] of [['Before', 'before'], ['After', 'after'], ['Changes', 'review']]) {
    await clickButtonWithText(client, label);
    await sleep(900); // the canvas repaints on the next frame, not on the click
    frames[key] = await frameHash(client);
  }
  const distinct = new Set(Object.values(frames)).size;
  record(
    'Before/Changes/After render differently',
    distinct === 3,
    `${distinct} distinct frames — ${JSON.stringify(frames)}`
  );

  // --- The walkthrough. "Previous" is disabled before the first step and the
  //     button relabels once walking has started.
  const beforeWalk = await evaluate(client, railStateExpr());
  await clickButtonWithText(client, 'Walk through');
  await sleep(700);
  const afterFirst = await evaluate(client, railStateExpr());
  const walkFrames = [await frameHash(client)];
  for (let i = 0; i < 2; i++) {
    await clickButtonWithText(client, 'Next');
    await sleep(800);
    walkFrames.push(await frameHash(client));
  }
  record(
    'walkthrough advances',
    beforeWalk.walkLabel === 'Walk through' && afterFirst.walkLabel === 'Next' && new Set(walkFrames).size > 1,
    `label ${beforeWalk.walkLabel} → ${afterFirst.walkLabel}; ${new Set(walkFrames).size} distinct frames over 3 steps`
  );
  record(
    'Previous disabled before the first step',
    beforeWalk.prevDisabled === true,
    `prevDisabled=${beforeWalk.prevDisabled}`
  );

  // --- Exclude, and its closure. Excluding a change also excludes everything
  //     that cannot stand without it, so the drop can be larger than one.
  const start = await evaluate(client, railStateExpr());
  await clickRailControl(client, 'Exclude this change', 0);
  const afterExclude = await evaluate(client, railStateExpr());
  const closure = start.kept - afterExclude.kept;
  record(
    'exclude removes at least the clicked row',
    afterExclude.excluded >= 1 && closure >= 1,
    `kept ${start.kept} → ${afterExclude.kept} (closure of ${closure}), Accept now "${afterExclude.accept}"`
  );
  record(
    'Accept relabels to N of M',
    /^Accept \d+ of \d+$/.test(afterExclude.accept || ''),
    `"${start.accept}" → "${afterExclude.accept}"`
  );

  // --- Restore. Deliberately *not* the mirror of exclude: rejection closes
  //     forward over dependents (`excludedWith`), restoration closes backward
  //     over prerequisites (`requiredWith`). So restoring a container brings
  //     back the container, not the children that went with it. The check is
  //     that the row came back and nothing else broke — and the two numbers are
  //     reported side by side, because the gap between them is a real thing for
  //     a reviewer to live with, not a bug to assert away.
  await clickRailControl(client, 'Include this change again', 0);
  const afterRestore = await evaluate(client, railStateExpr());
  record(
    'restore returns the clicked row',
    afterRestore.kept > afterExclude.kept && afterRestore.excluded < afterExclude.excluded,
    `kept ${afterExclude.kept} → ${afterRestore.kept} of ${start.kept} ` +
      `(exclude closed forward over ${closure}, restore closed back over ${afterRestore.kept - afterExclude.kept})`
  );

  // --- Accept N of M. Exclude one row again and accept the rest; the panel's
  //     own confirmation is the evidence the write happened.
  await clickRailControl(client, 'Exclude this change', 0);
  const toAccept = await evaluate(client, railStateExpr());
  await clickButtonWithText(client, 'Accept');
  const accepted = await waitFor(
    client,
    `(() => {
       const text = document.body.innerText || '';
       const m = text.match(/(Updated|Added) ([^\\n—]+?) (?:to your project )?— it is open on canvas/);
       return m ? { verb: m[1], name: m[2].trim() } : null;
     })()`,
    { timeoutMs: 30000, what: 'the panel to confirm the accept' }
  );
  record(
    'Accept N of M lands in the project',
    Boolean(accepted),
    `accepted "${toAccept.accept}" → ${accepted.verb} ${accepted.name}`
  );

  return { steps, frames };
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const out = { chunks: 6 };
  for (const arg of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!m) continue;
    out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

/** Copy the corpus fixture somewhere the editor may safely rewrite it. */
function copyCorpus() {
  const dest = path.join(os.tmpdir(), `aix15-corpus-${process.pid}`);
  fs.cpSync(CORPUS_PROJECT_DIR, dest, { recursive: true });
  // A copied `.git` would make the editor's version-control panel talk about
  // this repo's history, which is confusing at best.
  fs.rmSync(path.join(dest, '.git'), { recursive: true, force: true });
  return dest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.candidate) {
    console.error(
      'usage: scripted-session.js --candidate=<slug|path> [--project=<dir>] [--copy-corpus] [--smoke] [--chunks=N] [--json]'
    );
    process.exit(1);
  }

  const recording = loadRecording(String(args.candidate));
  const projectDir = args['copy-corpus'] ? copyCorpus() : args.project ? path.resolve(String(args.project)) : null;

  const client = await connect(await appTarget('editor'));
  const report = { candidate: recording.file, componentPath: recording.componentPath };
  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');

    if (projectDir) report.project = await openProject(client, projectDir);

    const installed = await evaluate(
      client,
      installScript(toSubmitArgs(recording.files), Number(args.chunks) || 6)
    );
    if (!installed.ok) throw new Error(installed.error);
    report.submission = { nodes: installed.nodes, connections: installed.connections };

    const turnBudget = await expectedTurns(client, recording.files);
    report.styleFindings = turnBudget.styleFindings;

    report.stage = await stage(client, {
      componentPath: recording.componentPath,
      description: recording.description || 'Replay a recorded candidate.'
    });
    report.review = await openReview(client);
    report.checks = compare({ ...recording.expected, ...turnBudget }, report);
    if (args.smoke) {
      const result = await smoke(client, recording.expected);
      report.smoke = result.steps;
      report.checks.push(...result.steps.map((s) => ({ name: `smoke: ${s.name}`, ok: s.ok, detail: s.detail })));
    }
    // A staging that silently disagreed with the recording is a failure, not a
    // footnote — everything downstream would be smoke-testing a graph no run
    // ever produced.
    report.ok = report.checks.every((c) => c.ok);
  } catch (error) {
    report.ok = false;
    report.error = error.message;
  } finally {
    client.close();
  }

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(format(report));
  process.exit(report.ok ? 0 : 1);
}

/**
 * What the editor did against what was recorded.
 *
 * The node and connection counts test `toSubmitArgs` — drop a field it needed
 * and the gate either rejects (no staging at all) or stages something smaller.
 * The change count tests the diff adapter end to end: the *live* base plus the
 * recorded candidate must produce the change set that was recorded next to it.
 * The one turn tests that the editor's context feeds the gate the same way the
 * headless harness does — a second turn would mean the same submission passed
 * there and failed here.
 */
function compare(expected, report) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  add('staged nodes', report.stage.staged.nodes === expected.nodes, `${report.stage.staged.nodes} vs ${expected.nodes}`);
  add(
    'staged connections',
    report.stage.staged.connections === expected.connections,
    `${report.stage.staged.connections} vs ${expected.connections}`
  );
  add(
    'turns',
    report.stage.turns === expected.turns,
    `${report.stage.turns} vs ${expected.turns} expected` +
      (expected.styleFindings.length > 0 ? ` (one AIX-006 style pass: ${expected.styleFindings.length} finding(s))` : '')
  );
  if (expected.isNewComponent !== null) {
    const mode = expected.isNewComponent ? 'create' : 'update';
    add('session mode', report.stage.mode === mode, `${report.stage.mode} vs ${mode}`);
  }
  if (expected.excludable !== null) {
    // `--smoke` accepts, which writes. Run it twice against the same project
    // and the second run diffs the candidate against a component that now *is*
    // the candidate — "No changes", zero rows. That is the harness's own
    // footprint, not a regression, and it should read as such.
    const alreadyApplied = report.review.summary === 'No changes' && report.review.excludeButtons === 0;
    add(
      'excludable rows',
      report.review.excludeButtons === expected.excludable,
      alreadyApplied
        ? 'the review reports "No changes" — this component already matches the candidate, so a previous ' +
          '--smoke run accepted it. Re-copy the project (--copy-corpus) before re-running.'
        : `${report.review.excludeButtons} vs ${expected.excludable} excludable of ${expected.changes} recorded changes`
    );
  }
  return checks;
}

function format(report) {
  const lines = [`candidate: ${path.relative(REPO_ROOT, report.candidate)}`, `component: ${report.componentPath}`];
  if (report.project) lines.push(`project:   ${report.project.dir}${report.project.opened ? '' : ' (already open)'}`);
  if (report.submission) lines.push(`submitted: ${report.submission.nodes} nodes, ${report.submission.connections} connections`);
  if (report.stage) {
    lines.push(
      `staged:    ${report.stage.staged.legacyName} — ${report.stage.staged.nodes} nodes, ` +
        `${report.stage.staged.connections} connections (${report.stage.mode} mode, ${report.stage.turns} turn(s))`
    );
  }
  if (report.review) {
    lines.push(
      `review:    open — "${report.review.accept}"; summary "${report.review.summary}"; ` +
        `${report.review.excludeButtons} excludable row(s); Before/After/Walk through: ` +
        `${report.review.hasBefore}/${report.review.hasAfter}/${report.review.hasWalkthrough}`
    );
  }
  for (const check of report.checks ?? []) {
    lines.push(`  ${check.ok ? 'ok  ' : 'FAIL'} ${check.name}: ${check.detail}`);
  }
  if (report.error) lines.push(`FAILED:    ${report.error}`);
  return lines.join('\n');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { toSubmitArgs, loadRecording, installScript, PROBE, REQ };

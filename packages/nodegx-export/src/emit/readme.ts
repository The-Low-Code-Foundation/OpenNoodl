/**
 * `README.md` — the front door of the exported repository (EXP-004).
 *
 * ## Why this is a second file and not a section of the report
 *
 * They are reached by different routes and answer different questions.
 *
 * `EXPORT-REPORT.md` is the **record**: every node, wire and parameter the export refused, in the
 * exporter's own words. It is what the `TODO(export)` markers in the code point at, and it is
 * complete by construction — a reader arrives at it already looking for one specific thing.
 *
 * This file is what someone opens **first**, usually without having been sent anywhere. It has to
 * answer *what is this*, *how do I run it*, *what is missing*, *what do I do about it* and *can I
 * edit it* — and then get out of the way. It states no refusal individually; it says how many
 * there are and sends the reader next door.
 *
 * ## 🔴 It is emitted for every export, and it did not used to be
 *
 * Until EXP-004 the README was written inside `apiModules`, under `backend !== undefined &&
 * hasApi` — so it arrived only for a project with a NodeGX backend *and* something that queried
 * it. Six of the seven corpus fixtures got no README at all, which is the file a developer opens
 * first being absent from the export in the ordinary case. It is now emitted beside the report,
 * from the same data, unconditionally. The backend section is what became conditional.
 *
 * ## What it shares with the report, and what it must not
 *
 * The ordered next steps are **the same list**, from {@link nextSteps} — one decision, two
 * readers, the pattern `backendMode` already establishes here. What it does not share is the
 * itemised refusals: two full copies of that list would be two things to keep in step, and the
 * one that drifted would be the one nobody regenerated.
 *
 * 🔴 **No clock, no absolute path, no random id**, for the reason `report.ts` gives at length: the
 * generators are byte-stable, and a date line would turn every golden in the package into noise.
 *
 * @module emit/readme
 */

import { ExportReportData, backendMode, nextSteps, renderSteps } from './report';

export const README_PATH = 'README.md';

/** Just the two fields the README prints; the IR record carries more, and none of it belongs here. */
export interface ReadmeBackend {
  endpoint: string;
  appId: string;
}

/**
 * The README, as Markdown.
 *
 * Pure. `backend` is read only when {@link backendMode} says `connected` — a project can declare
 * cloud services and never query them, and an env-var section for a `src/api/client.ts` that was
 * never emitted would be instructions for configuring nothing.
 */
export function renderReadme(data: ExportReportData, backend: ReadmeBackend | null): string {
  const mode = backendMode(data);
  const out: string[] = [];

  out.push(`# ${data.projectName}`);
  out.push('');
  out.push(
    'A React app, generated from the NodeGX project of the same name. It is an ordinary Vite + ' +
      'React + TypeScript repository: there is no NodeGX runtime in it, nothing to register and ' +
      'nothing to install beyond what `package.json` already lists. It is yours now.'
  );
  out.push('');

  out.push('## Run it');
  out.push('');
  out.push('```');
  out.push('npm install');
  out.push('npm run dev');
  out.push('```');
  out.push('');
  out.push('`npm run build` type-checks and bundles it; `npm run preview` serves that build.');
  out.push('');

  if (mode === 'connected' && backend !== null) {
    out.push('## The backend it talks to');
    out.push('');
    out.push(
      'Data access lives in `src/api/`, and goes through `src/api/client.ts` to your project’s ' +
        'NodeGX backend. Two environment variables configure it, with your project’s own values ' +
        'as the defaults:'
    );
    out.push('');
    out.push(`- \`VITE_NODEGX_ENDPOINT\` — the backend’s base URL (default: \`${backend.endpoint}\`)`);
    out.push(`- \`VITE_NODEGX_APP_ID\` — the backend’s application id (default: \`${backend.appId}\`)`);
    out.push('');
    out.push(
      'Copy `.env.example` to `.env` to point at another deployment. No generated code needs editing.'
    );
    out.push('');
  }

  // ── What needs work, by count and by pointer, never item by item ───────────
  const steps = nextSteps(data);
  // The trailing "test it" step is on every export and is not a gap, so it is not counted as one.
  const gaps = steps.length - 1;

  out.push('## What to do next');
  out.push('');
  if (gaps === 0) {
    out.push(
      'Every node and every wire in the project had a translation, and the export refused none of ' +
        'them — `EXPORT-REPORT.md`, beside this file, says so in full, and says what that does and ' +
        'does not claim. So there is one thing left, and it is the one every export ends on.'
    );
    out.push('');
  } else {
    out.push(
      'The export could not translate everything. **`EXPORT-REPORT.md`, beside this file, is the ' +
        'complete list** — every node, wire and parameter it left out, with the reason it gave. ' +
        'Most of them also leave a marker where the code would have been:'
    );
    out.push('');
    out.push('```');
    out.push('grep -rn "TODO(export)" src');
    out.push('```');
    out.push('');
    out.push(
      'These are those, in the order they are worth doing — most-missing first, by how much of the ' +
        'running app is not there without them.'
    );
    out.push('');
  }
  out.push(...renderSteps(steps));
  out.push('');

  // ── The two things a developer has to know before they start typing ────────
  out.push('## Before you start editing');
  out.push('');
  out.push(
    '**Nothing here has been run.** Every line was generated by rule from your graph. Where the ' +
      'exporter had a rule for a node it emitted code from it, and where it did not it refused and ' +
      'said so — it never guesses. But it did not execute your project, did not record what it ' +
      'does, and did not compare this code against it. Nothing in this app has been verified ' +
      'against the app you built.'
  );
  out.push('');
  out.push(
    '**This export is one-way.** The code does not sync back: editing it changes nothing in ' +
      'NodeGX, and re-exporting overwrites whatever you changed here. Once you start editing, this ' +
      'repository is the source of truth — so commit it before you do.'
  );
  out.push('');

  return out.join('\n');
}

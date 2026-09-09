# `@nodegx/export`

Turns a [NodeGX](https://github.com/The-Low-Code-Foundation/NodeGX) project on disk into a React +
Vite application: project files → IR → analysis → generated source. It is the same code path the
editor's **Export React code** command runs; there is no second implementation.

Everything here is a pure function over files. Nothing opens a window, and nothing needs a display
server — which is the point: this is the half of NodeGX that a CI job or an agent can drive.

```bash
npm i @nodegx/export
```

Requires Node ≥ 22.

## Use

```js
import { emitApp, loadCatalog, parseProject, summarizePreflight, renderPreflight } from '@nodegx/export';
import fs from 'node:fs';
import path from 'node:path';

const catalog = loadCatalog();                 // ships with this package
const ir = parseProject('./my-project', catalog);
const app = emitApp(ir, catalog);

// What the export will produce, before choosing where to put it — writes nothing.
console.log(renderPreflight(summarizePreflight(app)));

for (const [file, contents] of Object.entries(app.files)) {
  fs.mkdirSync(path.dirname(path.join('out', file)), { recursive: true });
  fs.writeFileSync(path.join('out', file), contents);
}
```

`app.files` is a `path → contents` map; `app.copies` lists the files that travel byte-for-byte
(fonts and other `noodl_modules` assets) rather than being generated, because a `.ttf` is not a
string. `app.notes` and `app.report` are what the export dropped or deferred.

## What it does not do

- **It does not deploy.** Deploying the interpreted viewer needs the editor's live project model;
  this package parses files.
- **It does not read the graph the editor rewrites on open.** The editor applies a set of patches
  when it loads a project and this package reads the files as written. Where the two disagree, the
  export follows the file. Closing that gap is tracked as HLS-003.
- **It emits an app that does not yet pass `npm run build` in every case.** See
  [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24).

Both of those are worth knowing before putting this in a pipeline, because in a pipeline there is
nobody to notice.

## Licence

GPL-3.0.

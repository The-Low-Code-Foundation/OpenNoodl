# Changelog

All notable changes to `@nodegx/core`. This package follows semantic versioning; while the major is
`0`, a **minor** bump may change behaviour, and exported apps pin `^0.1.x` accordingly.

## 0.1.0 — 2026-09-01

First publish to npm. MIT, no runtime dependencies, React an optional peer dependency needed only
for the `@nodegx/core/react` entry point.

- `value`, `derived`, `signal`, `store`, `collection`, `channel` / `events`, `effect`, `batch`,
  and the React bindings on `@nodegx/core/react`.
- Behaviour is specified by [`CONTRACT.md`](./CONTRACT.md) — eleven clauses, each cited to the
  NodeGX runtime source it was read from, and each with a named test. Two clauses are the ones a
  reactive library would most likely get wrong: an identical write is **not** skipped (C2), and
  every signal pulse fires — there is **no** per-frame de-duplication (C4). Both are asserted
  against the actual interpreter by the parity tests in
  `packages/noodl-runtime/test/nodegx-core-parity.test.ts`.
- 2.8 KB gzipped against an 8 KB budget, enforced in CI by `npm run size:nodegx-core`.

### Known gaps in this release

Fixed in 0.1.1; a published version is immutable, so they could not be amended in place.

- No `LICENSE` file in the tarball, though `package.json` declares MIT.
- No `repository`, `homepage` or `bugs` fields, so the npm page has no link back to the source —
  and `npm publish --provenance` requires `repository`.
- No `prepublishOnly` script. `dist/` is gitignored and `files` lists only `dist`, `README.md` and
  `CONTRACT.md`, so a publish from a checkout that has not been built would ship an empty package
  without erroring.

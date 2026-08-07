/**
 * `test.failing` / `it.failing`, declared.
 *
 * The marker is a real Jest feature (jest-circus, Jest ≥ 28) and both packages run Jest
 * 29.7 — but the `@types/jest` that actually resolves in this monorepo is 27.5.2, which
 * predates it. Rather than move a hoisted dependency that eight packages share for the sake
 * of one suite, the declaration is written here and each corpus file imports it for the side
 * effect, so it applies exactly where it is used and nowhere else.
 *
 * Why the corpus needs it: NDA-001 lands *before* any fix, so the rows it documents are red
 * by design. `test.failing` inverts the result — the suite stays green in CI while the broken
 * behaviours are named, executed and asserted every run — and it **fails the moment a test
 * starts passing**, so the fix that lands in NDA-002/003 cannot land quietly.
 *
 * It is a `.ts` module rather than a `.d.ts` on purpose: a declaration file can only be
 * pulled in by a triple-slash reference, which the repo's lint rules disallow.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface It {
      /**
       * Marks a test as expected to fail. Passes when the body throws; **fails** when the
       * body succeeds, which is what makes it a ratchet rather than a skip.
       */
      failing: It;
    }
  }
}

export {};

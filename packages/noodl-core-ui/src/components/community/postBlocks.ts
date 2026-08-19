/**
 * NAT-007 — the shape of a post body, owned by the thing that draws it.
 *
 * ## 🔴 Why this type is declared here and not imported from the editor
 *
 * `noodl-core-ui` cannot import `noodl-editor` — it renders in Storybook, where the editor does
 * not exist. `views/Community.tsx` states the rule and this is the same arrangement: **the
 * renderer owns the view type, and the editor adapts to it.**
 *
 * ⚠️ That leaves two declarations of one model — this one and `models/community/postbody.ts`'s
 * `PostBlock` — which is exactly the arrangement this phase keeps paying for. So the drift is
 * caught by the **compiler** rather than by a reader: `models/community/threadview.ts` holds a
 * type-level assertion that the editor's `PostBlock` is assignable to this one, and
 * `typecheck:editor` fails the day either side grows a variant the other does not have.
 * 🔴 A grep would not catch it. An assignability check is not a copy of the type, it is a
 * question about it, and the answer changes when either side moves.
 *
 * ## ⚠️ There is no `html`, `raw` or `markup` variant, and that is the whole design
 *
 * The editor's renderer is `nodeIntegration: true, contextIsolation: false`. A post body is a
 * string a stranger wrote this morning. This model has **no field that could hold markup**, so a
 * view walking it has nothing to hand to `dangerouslySetInnerHTML` even by mistake — the text
 * children React escapes are the only thing that reaches the screen. That is the argument, and it
 * is a structural one rather than a promise about a sanitiser's ordering.
 *
 * @module noodl-core-ui/components/community/postBlocks
 */

/**
 * A run of text inside a block.
 *
 * ⚠️ `href` on a link has already been through the editor's allow-list twice by the time it gets
 * here — once on the platform, once at `readPostBlocks`. This type cannot enforce that and does
 * not pretend to; what it enforces is that a link carries *a string*, so a renderer can never be
 * handed an object with an `onClick` in it.
 */
export type PostInline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'link'; text: string; href: string };

/**
 * One block of a post.
 *
 * 🔴 `unsupported` is a **first-class variant, not an error case.** NAT-007 AC3 requires that a
 * block kind the editor cannot render is *skipped visibly*: dropping it silently shows a reader a
 * post with a hole in it that neither end can see, and passing it through raw is the thing this
 * whole model exists to prevent. The marker carries a sanitised label and never the content.
 */
export type PostBlock =
  | { kind: 'paragraph'; inlines: PostInline[] }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; inlines: PostInline[] }
  | { kind: 'list'; ordered: boolean; items: PostInline[][] }
  | { kind: 'codeblock'; text: string }
  | { kind: 'unsupported'; label: string };

# The React 19 runtime — what changes when you opt in

NodeGX apps render on React. Today every project runs on **React 18.3** by
default. You can switch any project to **React 19** per project, and switch
back just as easily — nothing migrates without you asking.

## How to switch

**Project Settings → Runtime → React 19.** The change takes effect in the live
preview immediately and applies to your next deploy — preview and deploy always
use the same runtime, so what you previewed is what you ship. Selecting
"React 18.3 (default)" switches back.

Deployed apps freeze their React copy at deploy time. Switching the setting
never changes an app you have already deployed — only your next deploy does.

## What stays the same

The runtime was compared head-to-head on both React versions across a corpus of
real projects and purpose-built stress tests (signal chains and fan-out
ordering, frame-driven animations, router navigation, component-stack push/pop
transitions, repeaters over static and dynamically rebuilt data). **No
behavioural differences were found**: identical signal ordering, identical
rendered output, identical computed styles and screenshots, no new errors.

Noodl's own update scheduling (the per-frame batching that drives node updates)
behaves the same on both versions.

## What is different

Two things, both narrow:

1. **Custom modules that use removed React APIs.** React 19 removed several
   long-deprecated APIs that third-party or self-written Noodl modules might
   still call:

   - `ReactDOM.findDOMNode` (gone — the most likely one in practice)
   - `ReactDOM.render` / `ReactDOM.hydrate` / `unmountComponentAtNode`
   - String refs (`ref="myRef"`) and legacy context
   - `React.createFactory`

   Built-in nodes are unaffected — they report their DOM elements through an
   internal contract that works on both versions. A module component that
   relied on `findDOMNode` will degrade on React 19: NodeGX skips the lookup
   instead of crashing, but style fast-paths and size-tracking for that
   component may stop working. When you opt a project in, the editor runs an
   informational scan for these patterns in your project's code and reports
   what it finds — it never blocks you.

2. **HTML attribute order on inputs.** React 19 writes some attributes in a
   different order (for example, `type` lands last on `<input>` elements).
   Purely cosmetic — it can only matter if something in your app compares raw
   HTML strings.

## If something looks wrong

Switch the project back to React 18.3 in Project Settings and reload — the
setting is fully reversible and your project files are untouched apart from the
one setting. Then please report what differed.

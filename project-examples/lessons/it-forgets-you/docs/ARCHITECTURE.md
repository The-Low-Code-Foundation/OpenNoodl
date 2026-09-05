# Architecture

## Page map

- **Home** (`Pages/Home`) — The only page. Three logic nodes now sit on the canvas beside the visual tree: lesson 3's `Poked` and `Ease the poke`, and this lesson's `Pokes`.

## The tree this lesson adds

```
Page shell  (Group)                      lessons 1-2, untouched
  ├ Card    (Group)                       lesson 1, untouched
  │   ├ Creature (Circle)
  │   ├ Name     (Text)
  │   ├ Reaction (Text)                   lesson 3
  │   └ Score    (Text)                   ← step 4 — NO text parameter; the number arrives on a wire
  └ Board   (Group)                       lesson 2, untouched
      ├ Care  (Columns)                   lesson 2
      ├ Poke  (Button)                    lesson 3 — its Click now feeds TWO nodes
      └ Rest  (Button)                    ← step 5

Poked          (Switch)                   lesson 3
Ease the poke  (Animate To Value)         lesson 3
Pokes          (Counter)                  ← step 2:  Poke.onClick   → increase
                                          ← step 4:  currentCount   → Score.text
                                          ← step 5:  Rest.onClick   → reset
```

## 🔴 1. `Score` carries no `text` parameter, and that is load-bearing

The obvious thing to do is give the node a `text` of `0` so it reads sensibly before the wire is
drawn. **Do not.** With the port unset, a node whose wire ever stops delivering falls back to the
catalog default string `Text`, which **F4's placeholder check sees**. A parameter there would swallow
exactly the failure the gate exists to catch, and swallow it silently.

✅ **Measured**: `measure-from-disk.js` at 1280x900 reports `placeholders: 0` and the card renders
`0` under the creature's name. So the wire delivers at load and the number-to-string conversion
happens — both of which were predictions until the picture was looked at.

## ⚠️ 2. A number goes into a string port and is converted

`Counter.currentCount` is a `number`; `Text.text` is a `string`. The connection is allowed and the
value is coerced. This is stated in step 4's `detail` because it is the kind of thing a learner will
otherwise assume does not work — but it is **not true of every pair of ports**, and the prose says so
rather than implying a general rule.

## ⚠️ 3. Two pieces of state that do not know about each other

Pressing `Rest` returns the count to zero and leaves `Reaction` exactly as it was, because the
`Switch` is separate state and nothing tells it anything. **Left as it is, and pointed at in step 5's
`detail`** — it is a true and useful observation about state living in more than one place, and
"fixing" it would need a `Condition` or a second wire into the Switch, which belongs to
`moods`.

## ⚠️ 4. `Counter` is under **Math**, not **Variables**

The picker groups it with `Number Remapper` rather than with `Number`, `String` and `Boolean`.
Step 2's `detail` says so, because a learner told "add a Counter" will look under Variables first —
the Variables group holds per-instance value holders, which are a different node for a different job.

## 🔴 5. The curriculum's second node has no job here

`curriculum.json` lists this lesson's nodes as `["Counter", "Value Changed"]`. **`Counter` already
emits `countChanged`** — a signal output that fires whenever the count moves — so a `Value Changed`
watching the count would duplicate a port the node already has. `Value Changed` is for values that do
*not* announce themselves.

⬜ The entry's `nodes` line needs correcting when it is next edited. Recorded in `SYL-007`.

## Data model

No records. Spine lesson 4 is still purely in-memory: close the tab and the count is gone, which is
what makes the database lesson land later.

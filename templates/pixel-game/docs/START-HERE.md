# Pixel dungeon

A turn-based dungeon, built entirely out of NodeGX nodes. Press **Run**, then use the
**arrow keys** (or WASD). Collect the coins, find the way out, and watch what follows you.

There is no backend. Nothing here needs an account, a key or a server.

## The first thing to change

Open **Pages/Play** and find the node labelled **"EDIT — the five rooms — this list IS the game"**.
It is a `Static Data` node holding a JSON array:

```json
[
  {
    "name": "First steps",
    "grid": "############\n#@...c.....#\n…"
  }
]
```

Add a sixth room by adding a sixth entry. **That is the whole change** — no new component,
no rewiring, no code. The grid is text:

| character | what it is |
|---|---|
| `#` | a wall |
| `.` | floor |
| `c` | a coin |
| `E` | something that steps when you step |
| `@` | where you start |
| `>` | the way out |

Rooms are 12 wide and 9 tall. Keep the outer ring as `#` — off the grid counts as a
wall either way, but the border is what makes the room read as a room.

## How the game works, in the graph

Worth ten minutes if you came here to learn NodeGX rather than to play.

- **`Game/Move`** is the rule for walking, written **once** and placed **four times** — up,
  down, left, right — with `dx`/`dy` set on each instance. That is the whole reason there is
  one place to change what a step does.
- **Every decision in the game is a `Condition` node** you can open and follow: is there a
  wall, was there a coin, is this the way out, did one of them reach you, are you out of
  hearts, was that the last room.
- **`Game/Cell`** colours a tile with a `States` node — six kinds of tile, three colours each.
  The legend is a node, not a stylesheet.
- **The board is two repeaters**: one over the rows, one over each row’s cells.
- The `Function` nodes do not decide anything. They answer questions (is that a wall, how many
  of them are on your tile) and transform lists (take a coin, step the enemies, draw the room).

## The things that are deliberate

- **3 hearts.** Enough to learn a room, not enough to walk it blind.
- **The world only moves when you do.** Stand still and nothing happens — there is no clock.
- **Held keys repeat.** Walking a corridor should not need four separate presses.
- **Dying drops your coins and restarts the room.** The room number is kept, so a hard room
  stays where you left it.

## A library module travels with this project

`noodl_modules/keyboard-shortcuts` reads the arrow keys. It is already here — nothing to
install. **Do not delete it**: without it the board draws and never answers a key.

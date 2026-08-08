# 05 — Worked example: a storefront, decomposed before any nodes exist

**Source:** Richard's own architecture for the `ecommerce-example` storefront, written down after an
AI built the same page as one 66-node graph. This is what he would have created, and it is the
reference to copy from. Treat the structure as settled; it is what a decade of building these apps
produced, not a preference.

The point of this document is the **order**. Every component below was decided before a single node
was placed. Read it as "here is the whole app as a component tree", not "here is how to draw a page".

---

## Top menu bar

A `TopMenuBar` component, containing:

- **`MenuItems`** — a column and a **Repeater of `MenuItem` components**, the items defined as JSON.
  Not four sibling menu items: one component, one list.
  - **`MenuItem`** — a text, maybe an icon, a signal for when it is clicked, and all of its hover and
    disabled styling done inside it. The JSON row carries the label, the icon name and the
    destination.
- **`Basket`** — icon, counter, click signal, and hover animation. The hover uses a **`States` node**,
  because it is a combination of an icon and a text: the icon colour and the text style have to
  change *at the same time*, with transitions, and two independent per-node hover states cannot do
  that. This is the canonical reason the `States` node exists.
- **`SearchIcon`** → contains **`SearchBar`**, with the signals for typing, and possibly a
  **`SearchResults`** component that pops under the bar. States dictate the bar's position and width
  when the screen shrinks.
- **`Logo`** — icon plus text, with inputs for a light/dark switch, inputs for mount/unmount in case
  it needs hiding, and inputs for responsive mode.

**Navigation:** the menu items connect to either the Page Router's `Navigate`, or to a **Component
Stack** that pops the current component — where the "pages" are ordinary visual components rather
than `Page` components — with a fade animation between menu item clicks.

## Hero section

A `HeroSection` component, containing:

- **`HeroImage`** — with states (or the responsive layout node) to manage screen-size changes and the
  image display properties.
- **`Subtitle`**, **`Title`** — separate components. All the text components take **inputs to define
  the text**, so you place the component and add the words through its dynamic input port, and pick
  the colour from a selection of styles connected to the text's style input.
- **`ButtonRow`** — containing the buttons.

The reason the text is a component rather than a `Text` node: the type ramp is then defined once,
and every title on the site is the same object with different words.

## Info cards row — "delivery, returns, etc."

A column node with **`InfoCard` elements in a Repeater**. Each card has the icon, the label text and
the sub-label text, plus states for how it responds to screen-width changes.

The cards are defined **in the JSON on the Repeater**: the icon name, the label, the sub-label, and
any other responsive or colour style options, right there in the row.

> **So you never have three components as siblings. You have a Repeater and a Columns, and that is
> it.**

## Product card

- The image can be a plain node.
- The **product details** part is its own component: the name, description, price and so on, fed in
  through the Repeater's items.
- Options to **show the star rating** — in case there have not been any reviews yet.
- Options to **show or hide anything that might be empty**: tagline, tags, price, whatever. Just in
  case the data has a hole in it.
- **`Price`** is its own component. It contains either a full price — a text and a currency sign — or
  also a `Discount` sibling, where the full price is struck through and discounted to a lower price,
  possibly with a percentage indicator.
- The **"best seller" pill** is mounted or unmounted based on the data input, and its value is part
  of the Repeater's row.

Note how much of this is "what happens when the field is missing". That is not defensive
programming — it is the difference between a card that survives real data and one that only survives
the seed data.

## Browse by what it is for

Again a Columns and a Repeater. The categories come either from the database or from a statically
defined **global variable in the app settings**: an array of categories, each with a display title, a
DB value and an image URL.

Each card is hooked up to a **query that counts the products whose category matches the `DB value`
from that static row**, and:

- displays the number,
- hides the text if the number is 0,
- and is checked so the number can go to **two or three digits without being cut off or breaking the
  responsive layout**.

That last point is the one that always ships broken, because the seed data never has 148 of anything.

## Footer

A `Footer` component: columns, and heavy responsive design choices.

- The **copyright year pulls from the current date's year**, rather than being typed.
- **Shop, Company and Help are all one component** in a column and a Repeater; each item is a
  component.
- Each item's click drives a `Navigate` or `Navigate To Path` node, and has a hover animation.
- The Repeater's JSON carries everything needed to draw each item: its label, its URL destination,
  and what happens to it when the layout is responsive.

---

## What to take from this

Count the components: roughly twenty, most of them small, none of them duplicated. Then count what
the page component itself contains — six or seven instances.

Three habits run through all of it:

1. **Every repeated thing is a Repeater over JSON**, and the JSON row carries every decision that
   varies, including styling and responsive behaviour.
2. **Every leaf component owns its own interaction** — hover, disabled, transitions — and reports
   clicks upward as a signal instead of navigating on its own.
3. **Every field that can be empty has a way not to be drawn.** Ratings, taglines, discounts, badges,
   counts of zero.

And one order: **the tree first, the nodes second.**

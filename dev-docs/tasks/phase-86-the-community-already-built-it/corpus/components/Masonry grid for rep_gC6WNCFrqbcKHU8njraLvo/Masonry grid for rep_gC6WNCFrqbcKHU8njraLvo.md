# Noodl code

-----------------------------

```css
/* Apply this CSS to the parent container of the Repeater items */
.masonry-grid {
  display:flex !important; /* Uses flex to allow columns to dynamically size based on the width of their children */
  flex-wrap: wrap; /* Wraps items that overflow the width of the container */
  flex-direction: row !important; /* Override the default column direction */
  gap: 0.1rem; /* Horitontal gap between items */
  align-items: flex-start !important; /* Keeps the row items left aligned */
}

/* Apply this CSS to each item in the Repeater */
.masonry-grid-item {
  flex: 0 0 auto; /* Prevent items from stretching */
  break-inside: avoid; /* Avoids breaking items across rows */
  margin-bottom: 1rem; /* Adjust the gap between rows as needed */
  min-width: 0px !important; /* Makes sure the items shrink down to their text width */
}
```
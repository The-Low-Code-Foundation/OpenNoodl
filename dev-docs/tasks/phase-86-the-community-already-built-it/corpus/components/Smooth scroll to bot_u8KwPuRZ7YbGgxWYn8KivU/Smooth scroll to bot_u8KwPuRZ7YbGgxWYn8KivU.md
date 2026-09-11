# Noodl code

-----------------------------

Designed for a Function node

```javascript
// Get the actual DOM element using Inputs.This.getDOMElement()
const scrollableGroup = Inputs.This.getDOMElement();

// Ensure the chat div exists before trying to scroll
if (scrollableGroup) {
    // Scroll to the bottom of the chat div's scroll height
    scrollableGroup.scrollTo({
        top: scrollableGroup.scrollHeight,
        behavior: 'smooth' // Smooth scrolling
    });

    // Signal success after scrolling
    Outputs.Success();
} else {
    console.error('Scrollable Group not found.');
}
```
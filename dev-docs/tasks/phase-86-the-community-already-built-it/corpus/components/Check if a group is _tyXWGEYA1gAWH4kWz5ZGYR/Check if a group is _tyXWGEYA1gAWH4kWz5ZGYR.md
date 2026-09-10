# Noodl code

-----------------------------

function checkPosition() {
const inputElement = Script.Inputs.This.getDOMElement();

console.log("Element listener : " + inputElement);

if (!inputElement) {
console.error('Input element not found');
return;
}

const inputRect = inputElement.getBoundingClientRect();
const viewportHeight = window.innerHeight;
const distanceFromBottom = viewportHeight - inputRect.bottom;

if (distanceFromBottom <= 200) {
// Assuming Outputs.CloseToBottom is a function you defined in Noodl
Script.Outputs.CloseToBottom();
} else {
Script.Outputs.NotCloseToBottom();
}
}

Script.Signals.CheckPosition = checkPosition;

// You might need to call this function on specific events, like window resize or input focus
window.addEventListener('resize', checkPosition);
// Add other relevant event listeners as needed
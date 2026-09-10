# Noodl code

-----------------------------

// Check window width on page load before resize event
const initialWindowWidth = window.innerWidth;
Outputs.example = initialWindowWidth < 500 ? true : false;
Outputs.example2 = initialWindowWidth > 750 ? "big" : "small";

// Listen to the window resize event
window.addEventListener('resize', function() {
const windowWidth = window.innerWidth;
Outputs.example = windowWidth < 500 ? true : false;
Outputs.example2 = windowWidth > 750 ? "big" : "small";
});
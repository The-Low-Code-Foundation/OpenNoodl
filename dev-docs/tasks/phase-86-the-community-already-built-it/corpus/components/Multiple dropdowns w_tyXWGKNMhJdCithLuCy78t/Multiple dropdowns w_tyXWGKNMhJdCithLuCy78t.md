# Noodl code

-----------------------------

const objects = Inputs.Objects || \[\]; // Input array of objects

// Check if the input array is not empty
if (!objects.length) return//throw new Error('Input array is empty');

try {
// Map the input array to a new array with 'label' and 'value' fields
const mappedObjects = objects.map(obj => {
return {
Label: String(obj.name),
Value: String(obj.employeeId)
};
});

// Send the mapped array to the output

Outputs.EmployeesMounted = false;
setTimeout(function() {
Outputs.EmployeesMounted = true;
Outputs.MappedObjects = mappedObjects;
}, 50);

Outputs.Success();
} catch (error) {
Outputs.error = error;
Outputs.Failure();
}
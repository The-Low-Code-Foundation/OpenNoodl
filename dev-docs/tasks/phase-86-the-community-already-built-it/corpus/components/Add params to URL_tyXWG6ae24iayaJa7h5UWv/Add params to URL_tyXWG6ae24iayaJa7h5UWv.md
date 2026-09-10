# Noodl code

-----------------------------

const paramsObj = {
param1: 1,
param2: true,
param3: Inputs.param3,
param4: Inputs.maybeEmpty || "Just in case value",
param5: aVariableFromEarlierInTheFunction
};

const searchParams = new URLSearchParams(paramsObj);
let encodedUrl = Inputs.url + "?" + searchParams.toString()
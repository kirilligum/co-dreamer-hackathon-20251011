import { Daytona } from "@daytonaio/sdk";

// Initialize the Daytona client
const daytona = new Daytona({
  apiKey:
    "dtn_b36f4ce58a5c2485a7f4b9ab57302107fe02df28bccf47e394cf1503700d5ecd",
});

// Create the Sandbox instance
const sandbox = await daytona.create({
  language: "typescript",
});

// Run the code securely inside the Sandbox
const response = await sandbox.process.codeRun(
  'console.log("Hello World from code!")',
);
console.log(response.result);

import { Daytona } from "@daytonaio/sdk";

async function main() {
  // Initialize the Daytona client
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY environment variable is not set");
  }

  // Initialize the Daytona client
  const daytona = new Daytona({ apiKey });

  let sandbox;
  try {
    // Create the Sandbox instance
    sandbox = await daytona.create({
      language: "python",
    });
    // Run code securely inside the Sandbox
    const response = await sandbox.process.codeRun(
      'print("Sum of 3 and 4 is " + str(3 + 4))',
    );
    if (response.exitCode !== 0) {
      console.error("Error running code:", response.exitCode, response.result);
    } else {
      console.log(response.result);
    }
  } catch (error) {
    console.error("Sandbox flow error:", error);
  } finally {
    // Clean up the Sandbox
    if (sandbox) {
      await sandbox.delete();
    }
  }
}

main().catch(console.error);

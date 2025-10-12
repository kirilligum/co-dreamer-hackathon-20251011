import { Daytona } from '@daytonaio/sdk';

const apiKey = process.env.DAYTONA_API_KEY;
if (!apiKey) {
    throw new Error("DAYTONA_API_KEY environment variable is not set");
}

// Initialize the Daytona client
const daytona = new Daytona({ apiKey });

async function main() {
    const sandbox = await daytona.create();

    const appCode = Buffer.from(`
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Hello World</title>
        <link rel="icon" href="https://www.daytona.io/favicon.ico">
    </head>
    <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #0a0a0a; font-family: Arial, sans-serif;">
        <div style="text-align: center; padding: 2rem; border-radius: 10px; background-color: white; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            <img src="https://raw.githubusercontent.com/daytonaio/daytona/main/assets/images/Daytona-logotype-black.png" alt="Daytona Logo" style="width: 180px; margin: 10px 0px;">
            <p>This web app is running in a Daytona sandbox!</p>
        </div>
    </body>
    </html>
    """

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
  `);

    // Save the Flask app to a file
    await sandbox.fs.uploadFile(appCode, "app.py");

    // Create a new session and execute a command
    const execSessionId = "python-app-session";
    await sandbox.process.createSession(execSessionId);

    await sandbox.process.executeSessionCommand(execSessionId, ({
        command: `python app.py`,
        async: true,
    }));

    // Get the preview link for the Flask app
    const previewInfo = await sandbox.getPreviewLink(3000);
    console.log(`Flask app is available at: ${previewInfo.url}`);
}

main().catch(error => console.error("Error:", error));


import { Daytona } from '@daytonaio/sdk'
import * as dotenv from 'dotenv'
import axios from 'axios'

dotenv.config()

const daytona = new Daytona()

async function getClaudeResponse(apiKey: string, prompt: string): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages"
  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json"
  }
  const data = {
    "model": "claude-3-7-sonnet-latest",
    "max_tokens": 256,
    "messages": [{ "role": "user", "content": prompt }]
  }

  try {
    const response = await axios.post(url, data, { headers })
    if (response.status === 200) {
      const content = response.data.content || []
      return content
        .filter((item: any) => item.type === "text")
        .map((item: any) => item.text)
        .join("")
    } else {
      return `Error ${response.status}: ${response.statusText}`
    }
  } catch (error: any) {
    return `Error: ${error.message}`
  }
}

async function main() {
  const sandbox = await daytona.create()

  const prompt = "Python code that returns the factorial of 25. Output only the code. No explanation. No intro. No comments. Just raw code in a single code block."

  const result = await getClaudeResponse(process.env.ANTHROPIC_API_KEY || "", prompt)

  // Extract code from the response using regex
  const codeMatch = result.match(/```python\n(.*?)```/s)

  let code = codeMatch ? codeMatch[1] : result
  code = code.replace(/\\/g, '\\\\')

  // Run the extracted code in the sandbox
  const response = await sandbox.process.codeRun(code)
  console.log("The factorial of 25 is", response.result)
}

main().catch(console.error)


# Knowledge Dreamer Microservice

A TypeScript-based microservice that autonomously expands knowledge graphs using AI to explore connections between customers and products.

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start the Service

```bash
pnpm dreamer
```

The service will start on `http://localhost:3457`

## API Usage

### Health Check

```bash
curl http://localhost:3457/
```

**Response:**
```json
{
  "status": "ok",
  "service": "Knowledge Dreamer Microservice",
  "version": "1.0.0"
}
```

### Generate Knowledge Graph

**Endpoint:** `POST /api/v1/dream`

**Basic Example:**

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets for training AI models.",
    "product": "Weights and Biases Weave, featuring a UI for feedback and model evaluation."
  }'
```

**With Custom Parameters:**

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets for training AI models.",
    "product": "Weights and Biases Weave, featuring a UI for feedback and model evaluation.",
    "children_count": 3,
    "generations_count_int": 4
  }'
```

**Pretty-printed Output:**

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Acme Corp, a B2B SaaS company providing project management tools.",
    "product": "Slack, a team communication platform.",
    "children_count": 2,
    "generations_count_int": 2
  }' | jq '.'
```

## Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `customer` | string | Yes | - | Description of the customer/company to analyze |
| `product` | string | Yes | - | Description of the product to explore towards |
| `children_count` | number | No | 2 | Number of child nodes to generate per parent |
| `generations_count_int` | number | No | 3 | Number of expansion levels (depth) |

## Response Format

The API returns an array of nodes representing the knowledge graph:

```json
[
  {
    "id": "root",
    "content": "Customer description...",
    "edge": [
      {
        "target_id": "child-node-id-1",
        "relationship": "creates challenge of",
        "rationale": "Explanation of why this connection exists..."
      }
    ]
  },
  {
    "id": "child-node-id-1",
    "content": "Atomic fact about the customer...",
    "edge": [
      {
        "target_id": "grandchild-node-id-1",
        "relationship": "addressed by",
        "rationale": "How this progresses toward the product..."
      }
    ]
  }
]
```

## Example Use Cases

### 1. SaaS Product Exploration

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "TechStart Inc, a startup building collaboration tools for remote teams.",
    "product": "Notion, an all-in-one workspace.",
    "children_count": 2,
    "generations_count_int": 3
  }'
```

### 2. E-commerce Analysis

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "FashionHub, an online clothing retailer targeting Gen Z consumers.",
    "product": "Shopify, an e-commerce platform with social commerce features.",
    "children_count": 3,
    "generations_count_int": 2
  }'
```

### 3. Deep Technical Exploration

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "DataFlow Systems, building real-time data pipelines for financial services.",
    "product": "Apache Kafka with ksqlDB for stream processing.",
    "children_count": 2,
    "generations_count_int": 4
  }'
```

### 4. Save Output to File

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "HealthTech Co, developing patient monitoring systems.",
    "product": "AWS IoT Core for device connectivity.",
    "children_count": 2,
    "generations_count_int": 3
  }' > knowledge-graph.json
```

## Understanding the Output

### Node Structure

- **id**: Unique identifier (sanitized descriptive name + UUID)
- **content**: Atomic, verifiable fact about the topic
- **edge**: Array of connections to child nodes

### Edge Structure

- **target_id**: ID of the connected child node
- **relationship**: Type of connection (e.g., "relies on", "creates challenge of")
- **rationale**: Explanation of why this connection exists and how it progresses toward the product

### Graph Traversal

The root node represents the customer. Each generation explores concepts that:
1. Are exploratory (not just attributes)
2. Are factually accurate and verifiable
3. Progress toward the product domain
4. Build deeper understanding of product-market fit

## Performance

- **Typical completion time**: 5-10 seconds for 2 children × 3 generations
- **Node count**: `1 + (children_count × generations_count_int × avg_branching)`
- **Example**: 2 children, 3 generations = ~7-15 nodes

## Troubleshooting

### Service won't start

```bash
# Check if port 3457 is in use
lsof -i :3457

# Kill existing process if needed
kill -9 <PID>
```

### Request fails

```bash
# Verify service is running
curl http://localhost:3457/

# Check logs in terminal where service is running
```

### Empty or unexpected results

- Ensure customer and product descriptions are detailed
- Try adjusting `children_count` and `generations_count_int`
- Check server logs for LLM errors

## Advanced Usage

### Batch Processing

```bash
# Create multiple requests
for customer in "CompanyA" "CompanyB" "CompanyC"; do
  curl -X POST http://localhost:3457/api/v1/dream \
    -H "Content-Type: application/json" \
    -d "{
      \"customer\": \"$customer, description here\",
      \"product\": \"Target product\",
      \"children_count\": 2,
      \"generations_count_int\": 2
    }" > "graph-$customer.json"
done
```

### Integration with jq

```bash
# Extract all node IDs
curl -s -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{"customer": "...", "product": "..."}' \
  | jq -r '.[].id'

# Count total nodes
curl -s -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{"customer": "...", "product": "..."}' \
  | jq 'length'

# Extract all relationships
curl -s -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{"customer": "...", "product": "..."}' \
  | jq -r '.[] | .edge[] | .relationship' | sort | uniq
```

## Project Structure

```
mastra/
├── src/
│   └── dreamer/
│       ├── types.ts           # Data structures and interfaces
│       ├── llm-service.ts     # Gemini AI integration
│       ├── dreamer-service.ts # BFS expansion algorithm
│       ├── server.ts          # Hono API server
│       └── README.md          # Detailed technical docs
└── README.md                  # This file
```

## AI Configuration

### Using Google Gemini (Default)

The service is configured to use **Google Gemini 2.0 Flash Experimental** model by default.

#### API Key Setup

The Gemini API key is currently hardcoded in `src/dreamer/llm-service.ts` for the hackathon:

```typescript
const GEMINI_API_KEY = "AIzaSyBrXZyZMxmbfadixyCzAkFSRqAcXxAyqGs";
```

**For production**, use environment variables:

```typescript
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "your-api-key";
```

Then run:
```bash
export GEMINI_API_KEY="your-api-key-here"
pnpm dreamer
```

#### Get a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your key and use it in the configuration

### Using Local AI Models

You can configure the service to use local AI models instead of cloud-based services. Here are several options:

#### Option 1: Ollama (Recommended for Local)

[Ollama](https://ollama.ai) allows you to run LLMs locally on your machine.

**Setup:**

1. Install Ollama:
   ```bash
   # macOS
   brew install ollama

   # Linux
   curl -fsSL https://ollama.com/install.sh | sh

   # Windows
   # Download from https://ollama.com/download
   ```

2. Pull a model:
   ```bash
   ollama pull llama3.1:8b
   # or for better quality
   ollama pull llama3.1:70b
   ```

3. Modify `src/dreamer/llm-service.ts`:
   ```typescript
   import { Ollama } from 'ollama';

   export class LLMService {
     private ollama: Ollama;

     constructor() {
       this.ollama = new Ollama({ host: 'http://localhost:11434' });
     }

     async generateNodes(
       customerDetails: string,
       productDetails: string,
       currentNodeContent: string,
       childrenCount: number
     ): Promise<LLMGeneratedNode[]> {
       const prompt = this.generatePrompt(
         customerDetails,
         productDetails,
         currentNodeContent,
         childrenCount
       );

       const response = await this.ollama.generate({
         model: 'llama3.1:8b',
         prompt: prompt,
         format: 'json',
       });

       return JSON.parse(response.response);
     }
   }
   ```

4. Install Ollama SDK:
   ```bash
   pnpm add ollama
   ```

#### Option 2: LM Studio

[LM Studio](https://lmstudio.ai) provides a user-friendly interface for running local models.

**Setup:**

1. Download and install LM Studio
2. Download a model (e.g., Mistral 7B, Llama 3.1)
3. Start the local server (default: http://localhost:1234)
4. Use OpenAI-compatible API:

   ```typescript
   import OpenAI from 'openai';

   export class LLMService {
     private client: OpenAI;

     constructor() {
       this.client = new OpenAI({
         baseURL: 'http://localhost:1234/v1',
         apiKey: 'not-needed',
       });
     }

     async generateNodes(...): Promise<LLMGeneratedNode[]> {
       const prompt = this.generatePrompt(...);

       const response = await this.client.chat.completions.create({
         model: 'local-model',
         messages: [{ role: 'user', content: prompt }],
         response_format: { type: 'json_object' },
       });

       return JSON.parse(response.choices[0].message.content);
     }
   }
   ```

#### Option 3: llama.cpp Server

Run models using [llama.cpp](https://github.com/ggerganov/llama.cpp) for maximum performance.

**Setup:**

1. Clone and build llama.cpp:
   ```bash
   git clone https://github.com/ggerganov/llama.cpp
   cd llama.cpp
   make
   ```

2. Download a GGUF model (e.g., from Hugging Face)

3. Start the server:
   ```bash
   ./server -m models/llama-3.1-8b.gguf -c 4096
   ```

4. Use OpenAI-compatible endpoint (http://localhost:8080)

#### Option 4: LocalAI

[LocalAI](https://localai.io) is a drop-in replacement for OpenAI API.

**Setup with Docker:**

```bash
docker run -p 8080:8080 \
  -v $PWD/models:/models \
  -e THREADS=4 \
  localai/localai:latest \
  --models-path /models \
  --context-size 4096
```

Then configure the service to use http://localhost:8080

### Model Recommendations

| Use Case | Cloud Model | Local Model | Notes |
|----------|-------------|-------------|-------|
| **Production** | Gemini 2.0 Flash | - | Fast, cost-effective |
| **High Quality** | GPT-4 | Llama 3.1 70B | Best reasoning |
| **Speed** | Gemini Flash | Llama 3.1 8B | Quick responses |
| **Privacy** | - | Mistral 7B | 100% local |
| **Low Resource** | Claude Haiku | Phi-3 Mini | Small footprint |

### Model Configuration Parameters

Adjust these in your LLM service for better results:

```typescript
{
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.7,        // Higher = more creative (0.0-1.0)
    topP: 0.9,               // Nucleus sampling
    topK: 40,                // Top-k sampling
    maxOutputTokens: 2048,   // Response length limit
    responseMimeType: 'application/json',
  }
}
```

### Switching Between AI Providers

Create a factory pattern for easy switching:

```typescript
// src/dreamer/llm-factory.ts
export function createLLMService(provider: string): LLMService {
  switch (provider) {
    case 'gemini':
      return new GeminiLLMService();
    case 'ollama':
      return new OllamaLLMService();
    case 'lmstudio':
      return new LMStudioLLMService();
    default:
      return new GeminiLLMService();
  }
}
```

Then use:
```bash
export LLM_PROVIDER="ollama"
pnpm dreamer
```

## Other Configuration

### Port Configuration

To change the port, edit `src/dreamer/server.ts`:

```typescript
const port = 3457; // Change to your desired port
```

## What's Next?

This microservice is designed to be part of a larger Code Dreamer system:

1. **Email Generator**: Use the knowledge graph to create personalized sales emails
2. **Fact Verification**: Add web search to verify generated facts
3. **Graph Visualization**: Build UI to explore the knowledge graph
4. **Feedback Loop**: Implement reinforcement learning based on email performance

## License

See LICENSE file in project root.

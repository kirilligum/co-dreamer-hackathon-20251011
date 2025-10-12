# Knowledge Dreamer Microservice

The Knowledge "Dreamer" Microservice is the core component of the Code Dreamer project, responsible for autonomous knowledge graph expansion through a self-learning mechanism.

## Overview

The service starts from an initial concept (the customer) and generates new, atomic facts (nodes) that move towards a specific direction (the product). This "dreaming" process creates a nuanced understanding of the customer and product-market fit.

## Architecture

### Key Components

1. **Data Structures** (`types.ts`)
   - `Node`: Represents atomic, verifiable facts in the knowledge graph
   - `Edge`: Represents connections between nodes with relationship types and rationale
   - `DreamRequest`: Input parameters for the expansion process

2. **LLM Service** (`llm-service.ts`)
   - Integrates with Google Gemini 2.0 Flash model
   - Generates new nodes using structured JSON output
   - Implements the Node Discovery Prompt for consistent generation

3. **Dreamer Service** (`dreamer-service.ts`)
   - Core BFS-based expansion algorithm
   - Manages the knowledge graph store
   - Controls depth and breadth of expansion

4. **API Server** (`server.ts`)
   - Hono-based REST API
   - Single POST endpoint for triggering expansion
   - Health check endpoint

## Algorithm: BFS-based Knowledge Expansion

The expansion follows a Breadth-First Search (BFS) approach:

1. **Initialization**: Create root node from customer description
2. **Generation Loop**: For each generation level:
   - Process all nodes in current generation
   - For each node, generate N children using LLM
   - Create edges with relationship types and rationale
   - Add children to next generation queue
3. **Finalization**: Return complete graph as array

## API Reference

### POST /api/v1/dream

Triggers the knowledge graph expansion process.

**Request Body:**
```json
{
  "customer": "Description of the customer",
  "product": "Description of the target product",
  "children_count": 2,        // Optional, default: 2
  "generations_count_int": 3  // Optional, default: 3
}
```

**Response:**
```json
[
  {
    "id": "node-id",
    "content": "Atomic fact description",
    "edge": [
      {
        "target_id": "child-node-id",
        "relationship": "relationship-type",
        "rationale": "Why this connection exists"
      }
    ]
  }
]
```

### GET /

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "Knowledge Dreamer Microservice",
  "version": "1.0.0"
}
```

## Running the Service

### Prerequisites

- Node.js v20+
- pnpm

### Start the Service

```bash
pnpm dreamer
```

The service will start on `http://localhost:3457`

### Test the Service

```bash
./test-dreamer.sh
```

Or manually with curl:

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets.",
    "product": "Weights and Biases Weave, featuring a UI for feedback.",
    "children_count": 2,
    "generations_count_int": 2
  }'
```

## Implementation Details

### Node ID Generation

Node IDs are generated from the LLM-provided descriptive names:
- Sanitized to lowercase, alphanumeric with hyphens
- Limited to 50 characters
- Appended with 8-character UUID for uniqueness

### LLM Configuration

- Model: `gemini-2.0-flash-exp`
- Output format: JSON (structured)
- Temperature: Default
- Response includes exactly N nodes as requested

### Error Handling

- Individual node failures don't stop the expansion
- Errors are logged and the process continues
- Failed generations are skipped

## Example Output

For customer "Pearls of Wisdom" (synthetic data) and product "Weights and Biases Weave" (model evaluation UI):

```
Generation 1: 2 nodes
  - Synthetic Data Bias
  - AI Model Explainability

Generation 2: 4 nodes
  - Bias Mitigation Techniques
  - Synthetic Data Evaluation Metrics
  - SHAP Values Explainability
  - Synthetic Data Bias (different aspect)

Total: 7 nodes (1 root + 6 generated)
Completion time: ~6.6 seconds
```

## Configuration

### Environment Variables

The Gemini API key is currently hardcoded for the hackathon. For production, use:

```bash
GEMINI_API_KEY=your-api-key-here
```

### Customization

Modify these parameters in your request:
- `children_count`: Breadth of exploration (nodes per parent)
- `generations_count_int`: Depth of exploration (number of levels)

## Future Enhancements

- [ ] Add fact verification using web search
- [ ] Implement graph visualization
- [ ] Add persistence layer (Neo4j/MongoDB)
- [ ] Support for resuming interrupted expansions
- [ ] Rate limiting and API key management
- [ ] Metrics and monitoring

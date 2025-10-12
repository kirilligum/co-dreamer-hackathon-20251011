# CoDreamer API Guide

Complete guide for using the Knowledge Dreamer and CoDreamer APIs via curl commands.

## Overview

The CoDreamer system consists of two microservices:

1. **Knowledge Dreamer** - Generates knowledge graphs from customer jobs and product features
2. **CoDreamer** - Uses knowledge graphs to train an RL agent that generates personalized sales emails

## Architecture Flow

```
Customer Job + Product Feature
         ↓
   [Dream API] - Generates Knowledge Graph
         ↓
   Knowledge Graph (JSON)
         ↓
   [CoDreamer API] - RL Training Pipeline
         ↓
   Trained Agent → Personalized Emails
```

---

## Part 1: Knowledge Dreamer API

### Start the Dream API Server

**Using Mastra Workflow (Recommended):**

```bash
cd mastra
USE_WORKFLOW=true npx tsx src/dreamer/server.ts
```

**Using Legacy BFS:**

```bash
cd mastra
npx tsx src/dreamer/server.ts
```

The server runs on **http://localhost:3457**

> **Note:** The Mastra workflow implementation provides better observability with step-by-step logging and structured execution. Both implementations produce identical output formats.

### Check Server Status

```bash
curl http://localhost:3457/health
```

**Response:**
```json
{
  "status": "ok",
  "message": "Knowledge Dreamer is running"
}
```

### Generate a Knowledge Graph

**Endpoint:** `POST /api/v1/dream`

**Parameters:**
- `customer` (required): The customer job or need
- `product` (required): Your product or feature
- `children` (optional, default: 2): Number of child nodes per generation
- `generations` (optional, default: 3): Number of expansion generations

**Example 1: Basic Request**

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets for training AI models.",
    "product": "Weights and Biases Weave, featuring a UI for feedback and model evaluation."
  }'
```

**Example 2: Custom Parameters**

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets for training AI models.",
    "product": "Weights and Biases Weave, featuring a UI for feedback and model evaluation.",
    "children": 3,
    "generations": 4
  }'
```

**Example 3: Save to File**

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets for training AI models.",
    "product": "Weights and Biases Weave, featuring a UI for feedback and model evaluation."
  }' \
  -o knowledge-graph.json
```

**Response Format:**

```json
[
  {
    "id": "Customer Job",
    "content": "Pearls of Wisdom generates synthetic data sets for training AI models",
    "edge": [
      {
        "target_id": "synthetic-data-quality-a1b2c3",
        "relationship": "faces challenge of",
        "rationale": "Ensuring synthetic data maintains statistical properties and realism"
      }
    ]
  },
  {
    "id": "synthetic-data-quality-a1b2c3",
    "content": "Validating quality and bias in synthetic training data",
    "edge": [
      {
        "target_id": "Product Feature",
        "relationship": "addressed by",
        "rationale": "W&B Weave provides UI for feedback collection and evaluation"
      }
    ]
  },
  {
    "id": "Product Feature",
    "content": "Weights and Biases Weave, featuring a UI for feedback and model evaluation",
    "edge": []
  }
]
```

### Visualize the Knowledge Graph

**Generate PNG, SVG, and Mermaid diagram:**

```bash
# After saving the knowledge graph to a file
npx tsx scripts/graph-to-png.ts knowledge-graph.json

# This creates:
# - knowledge-graph.png (raster image)
# - knowledge-graph.svg (vector graphic)
# - knowledge-graph.mmd (Mermaid source)
```

---

## Part 2: CoDreamer API

### Start the CoDreamer API Server

```bash
# Make sure you have the environment variables set
# OPENAI_API_KEY - Required for LLM agent
# WANDB_API_KEY - Optional for logging

python -m uvicorn codreamer.scripts.api:app --host 0.0.0.0 --port 8000
```

The server runs on **http://localhost:8000**

### Check Server Status

```bash
curl http://localhost:8000/
```

**Response:**
```json
{
  "status": "ok",
  "service": "codreamer-api"
}
```

### Run the Complete Pipeline

**Endpoint:** `POST /learn-loop`

**Parameters:**
- `graph` (optional): Knowledge graph nodes array. If not provided, uses existing graph from `codreamer/data/graph.json`
- `iterations` (optional, default: 3): Number of learning loop iterations
- `depth` (optional): Max turns for agent exploration per rollout

#### Option A: Use Knowledge Graph from Dream API

```bash
# Step 1: Generate knowledge graph with Dream API
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets for training AI models.",
    "product": "Weights and Biases Weave, featuring a UI for feedback and model evaluation."
  }' \
  -o /tmp/kg.json

# Step 2: Pass the knowledge graph to CoDreamer
curl -X POST http://localhost:8000/learn-loop \
  -H "Content-Type: application/json" \
  -d "{
    \"graph\": $(cat /tmp/kg.json),
    \"iterations\": 3,
    \"depth\": 5
  }"
```

#### Option B: Inline Knowledge Graph

```bash
curl -X POST http://localhost:8000/learn-loop \
  -H "Content-Type: application/json" \
  -d '{
    "graph": [
      {
        "id": "Customer Job",
        "content": "Pearls of Wisdom generates synthetic data sets for training AI models",
        "edge": [
          {
            "target_id": "evaluation-challenges-a1b2",
            "relationship": "faces challenge of",
            "rationale": "Need systematic way to evaluate synthetic data quality"
          }
        ]
      },
      {
        "id": "evaluation-challenges-a1b2",
        "content": "Collecting feedback and measuring model performance on synthetic data",
        "edge": [
          {
            "target_id": "Product Feature",
            "relationship": "addressed by",
            "rationale": "Weave UI enables feedback collection and evaluation workflows"
          }
        ]
      },
      {
        "id": "Product Feature",
        "content": "Weights and Biases Weave, featuring a UI for feedback and model evaluation",
        "edge": []
      }
    ],
    "iterations": 2,
    "depth": 5
  }'
```

#### Option C: Use Existing Knowledge Graph

```bash
# Uses the graph already saved in codreamer/data/graph.json
curl -X POST http://localhost:8000/learn-loop \
  -H "Content-Type: application/json" \
  -d '{
    "iterations": 3,
    "depth": 5
  }'
```

**Response:**

```json
{
  "run_id": "api-20251012-103045-a3f2e1",
  "results_path": "/home/user/codreamer/results/runs/api-20251012-103045-a3f2e1"
}
```

### Understanding the Pipeline

The learning loop runs 5 steps per iteration:

1. **Generate Trajectories** - LLM agent explores knowledge graph using tools (get_connected_nodes, get_relevant_context)
2. **Score Trajectories** - Evaluates email quality using LLM judge
3. **GRPO Update** - Trains the model using Group Relative Policy Optimization
4. **Update KG Weights** - Credits nodes used in high-reward trajectories
5. **Evaluate** - Generates final emails with citations to knowledge graph nodes

### View Results

After the pipeline completes, results are saved in the `results_path`:

```bash
# View the final email
cat codreamer/results/runs/api-20251012-103045-a3f2e1/final_email.json

# View emails per iteration
cat codreamer/results/runs/api-20251012-103045-a3f2e1/iter1_email.json
cat codreamer/results/runs/api-20251012-103045-a3f2e1/iter2_email.json
cat codreamer/results/runs/api-20251012-103045-a3f2e1/iter3_email.json

# View knowledge graph node scores (updated after each iteration)
cat codreamer/results/runs/api-20251012-103045-a3f2e1/iter1_node_scores.json
cat codreamer/results/runs/api-20251012-103045-a3f2e1/iter2_node_scores.json
cat codreamer/results/runs/api-20251012-103045-a3f2e1/iter3_node_scores.json

# View reward metrics
cat codreamer/results/runs/api-20251012-103045-a3f2e1/iter1_rewards_metrics.json
```

**Example Final Email:**

```json
{
  "subject": "Streamline Your AI Model Evaluation with W&B Weave",
  "body": "Hi Alex,\n\nI noticed that Pearls of Wisdom generates synthetic datasets for AI model training. One key challenge in this space is systematically evaluating synthetic data quality and collecting feedback on model performance.\n\nWeights & Biases Weave addresses this with a powerful UI for feedback collection and model evaluation workflows. You can track experiments, gather team feedback, and measure how well your synthetic data performs in real training scenarios—all in one place.\n\nWould you be open to a 20-minute call to see how Weave could fit into your evaluation pipeline?\n\nBest,\nSales Rep",
  "citations": [
    "evaluation-challenges-a1b2",
    "synthetic-data-quality-metrics-c3d4",
    "feedback-collection-workflows-e5f6",
    "Product Feature"
  ]
}
```

---

## Complete End-to-End Example

This example shows the complete workflow: generating a knowledge graph for Pearls of Wisdom (customer) and Weights & Biases Weave (product), then using it to train an agent that generates personalized sales emails.

```bash
# 1. Start Dream API with Mastra Workflow (Terminal 1)
cd mastra
USE_WORKFLOW=true npx tsx src/dreamer/server.ts

# 2. Start CoDreamer API (Terminal 2)
cd ..
python -m uvicorn codreamer.scripts.api:app --host 0.0.0.0 --port 8000

# 3. Generate Knowledge Graph (Terminal 3)
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets for training AI models.",
    "product": "Weights and Biases Weave, featuring a UI for feedback and model evaluation.",
    "children": 2,
    "generations": 3
  }' \
  -o pearls-weave-kg.json

# 4. Visualize the Knowledge Graph
npx tsx scripts/graph-to-png.ts pearls-weave-kg.json
# Open pearls-weave-kg.png to view the graph

# 5. Run CoDreamer Pipeline
curl -X POST http://localhost:8000/learn-loop \
  -H "Content-Type: application/json" \
  -d "{
    \"graph\": $(cat pearls-weave-kg.json),
    \"iterations\": 3,
    \"depth\": 5
  }" | tee pipeline-response.json

# 6. Extract run_id and view results
RUN_ID=$(cat pipeline-response.json | jq -r '.run_id')
cat codreamer/results/runs/$RUN_ID/final_email.json | jq .
```

**What happens in this workflow:**

1. **Dream API** generates a knowledge graph exploring the connection between Pearls of Wisdom's need (generating quality synthetic data) and how W&B Weave solves it (evaluation UI and feedback tools)

2. **Visualization** creates PNG/SVG diagrams showing:
   - Blue node: "Customer Job" (Pearls of Wisdom's challenge)
   - Gray nodes: Intermediate concepts (evaluation needs, feedback workflows, quality metrics)
   - Green node: "Product Feature" (W&B Weave solution)

3. **CoDreamer Pipeline** trains an RL agent over 3 iterations:
   - Agent explores the knowledge graph using tools
   - Generates multiple email variations per iteration
   - Learns which knowledge graph paths lead to better emails
   - Updates node weights based on which facts appeared in high-quality emails

4. **Final Output** is a personalized sales email that:
   - Addresses Pearls of Wisdom's specific challenges
   - Explains how W&B Weave solves them
   - Cites specific nodes from the knowledge graph
   - Improves with each iteration as the agent learns

---

## API Documentation

### Interactive Swagger UI

Both APIs provide interactive documentation:

- **Dream API:** http://localhost:3457 (check server.ts for docs endpoint if available)
- **CoDreamer API:** http://localhost:8000/docs

Visit these URLs in your browser to:
- Explore all endpoints
- View request/response schemas
- Test API calls directly from the browser

---

## Important Notes

### Knowledge Graph Requirements

The knowledge graph MUST include two anchor nodes:

1. **"Customer Job"** - The seed node (customer need/problem)
2. **"Product Feature"** - The target endpoint (your solution)

These exact IDs are required because CoDreamer's tools filter paths from Customer Job to Product Feature.

### Node Structure

Each node must have:
```json
{
  "id": "unique-node-id",
  "content": "Description of the node",
  "edge": [
    {
      "target_id": "another-node-id",
      "relationship": "relationship-type",
      "rationale": "Why this connection exists"
    }
  ]
}
```

### Environment Variables

Required for CoDreamer:
```bash
export OPENAI_API_KEY="sk-..."
```

Optional:
```bash
export WANDB_API_KEY="..."  # For Weights & Biases logging
export GEMINI_API_KEY="..." # For Dream API (if using Gemini)
```

---

## Troubleshooting

### Dream API Not Responding

```bash
# Check if server is running
curl http://localhost:3457/health

# Check server logs
# Look at the terminal where you started the server
```

### CoDreamer API Errors

```bash
# Check API logs
tail -f /tmp/api_server.log

# Verify OpenAI API key is set
echo $OPENAI_API_KEY

# Check if port 8000 is available
lsof -i :8000
```

### Permission Errors with Weave

These are warnings and can be ignored. The pipeline will run in offline mode:
```
WARNING: Failed to initialize Weave (W&B offline mode)
```

---

## Summary

**Two-step workflow:**

1. **Dream API** → Generates knowledge graph from customer job + product feature
2. **CoDreamer API** → Trains RL agent on knowledge graph → Generates personalized emails

Both APIs are REST-based and can be used with curl, making them easy to integrate into any workflow or automation pipeline.

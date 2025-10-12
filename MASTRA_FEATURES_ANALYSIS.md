# Mastra Features for Dream Implementation

Analysis of which Mastra features could enhance the Knowledge Dreamer microservice.

## Current Implementation

The Dream service currently:
- Generates knowledge graphs in-memory
- Returns JSON via REST API
- No persistence between requests
- No query/retrieval capabilities
- No semantic search

## Recommended Mastra Features

### 1. 🗄️ **Database Storage with LibSQL/PostgreSQL** (HIGH PRIORITY)

**Use Case:** Persist knowledge graphs for reuse and historical analysis

**Benefits:**
- Store generated graphs with metadata (customer, product, timestamp)
- Query previously generated graphs
- Track graph evolution over time
- Enable analytics on graph patterns

**Implementation:**
```typescript
import { LibSQLStore } from '@mastra/libsql';
// or
import { PostgresStore } from '@mastra/pg';

const storage = new LibSQLStore({
  url: 'file:./data/graphs.db'
});

// After generating graph
await storage.save({
  id: graphId,
  customer: body.customer,
  product: body.product,
  nodes: graph,
  metadata: {
    nodeCount: graph.length,
    generationTime,
    timestamp: Date.now()
  }
});
```

**New Endpoints:**
- `GET /api/v1/graphs` - List all generated graphs
- `GET /api/v1/graphs/:id` - Retrieve specific graph
- `GET /api/v1/graphs/search?customer=X&product=Y` - Find similar graphs

---

### 2. 🔍 **RAG for Node Retrieval** (HIGH PRIORITY)

**Use Case:** Semantic search over knowledge graph nodes

**Benefits:**
- Find similar nodes across different graphs
- Retrieve relevant context for new expansions
- Enable "smart suggestions" during graph generation
- Reuse high-quality nodes from previous graphs

**Implementation:**
```typescript
import { PgVector } from '@mastra/pg';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

// Initialize vector store
const vectorStore = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING
});

// After generating each node, embed and store
async function storeNodeEmbedding(node: Node) {
  const { embeddings } = await embedMany({
    values: [node.content],
    model: openai.embedding('text-embedding-3-small')
  });

  await vectorStore.upsert({
    indexName: 'knowledge-nodes',
    vectors: embeddings,
    metadata: [{
      nodeId: node.id,
      content: node.content,
      graphId: currentGraphId
    }]
  });
}

// Query similar nodes
async function findSimilarNodes(query: string, topK = 5) {
  const { embeddings } = await embedMany({
    values: [query],
    model: openai.embedding('text-embedding-3-small')
  });

  return await vectorStore.query({
    indexName: 'knowledge-nodes',
    queryVector: embeddings[0],
    topK
  });
}
```

**New Endpoints:**
- `POST /api/v1/nodes/search` - Semantic search over all nodes
- `POST /api/v1/nodes/similar/:nodeId` - Find similar nodes
- `POST /api/v1/suggest` - Suggest nodes for expansion

---

### 3. 📊 **Memory for Session State** (MEDIUM PRIORITY)

**Use Case:** Track multi-turn graph refinement sessions

**Benefits:**
- Allow iterative graph refinement
- Store user feedback on generated nodes
- Enable "continue from where I left off" functionality

**Implementation:**
```typescript
import { Memory } from '@mastra/memory';

const memory = new Memory({
  storage: new LibSQLStore({ url: 'file:./data/memory.db' })
});

// Store session
await memory.saveMessages({
  threadId: sessionId,
  messages: [{
    role: 'user',
    content: { action: 'generate', customer, product }
  }, {
    role: 'assistant',
    content: { graphId, nodeCount, status: 'completed' }
  }]
});

// Retrieve session history
const history = await memory.getMessages({ threadId: sessionId });
```

**New Endpoints:**
- `POST /api/v1/sessions` - Start new refinement session
- `GET /api/v1/sessions/:id` - Get session history
- `POST /api/v1/sessions/:id/refine` - Refine existing graph

---

### 4. 🎯 **Agents for Interactive Graph Building** (MEDIUM PRIORITY)

**Use Case:** Let an agent interactively explore and expand the graph

**Benefits:**
- Agent decides which nodes to expand based on quality
- Tool calling for web search to validate facts
- More intelligent exploration strategies

**Implementation:**
```typescript
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core';

const graphAgent = new Agent({
  name: 'graph-builder',
  instructions: 'Build knowledge graphs by exploring customer-product connections',
  model: openai('gpt-4o'),
  tools: {
    expandNode: createTool({
      id: 'expand-node',
      description: 'Generate child nodes for a parent',
      inputSchema: z.object({
        parentId: z.string(),
        childCount: z.number()
      }),
      execute: async ({ parentId, childCount }) => {
        // Generate children using LLM
        return { children: [...] };
      }
    }),
    searchWeb: createTool({
      id: 'search-web',
      description: 'Verify facts with web search',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        // Use web search API
        return { facts: [...] };
      }
    })
  }
});

// Agent-driven graph generation
const result = await graphAgent.generate([
  {
    role: 'user',
    content: `Build a knowledge graph from "${customer}" to "${product}"`
  }
]);
```

---

### 5. 🔬 **Evals for Graph Quality** (MEDIUM PRIORITY)

**Use Case:** Measure and improve graph quality over time

**Benefits:**
- Score graphs for coherence, relevance, completeness
- Compare workflow vs legacy implementation
- A/B test different expansion strategies

**Implementation:**
```typescript
import { Eval } from '@mastra/evals';

const graphQualityEval = new Eval({
  name: 'graph-quality',
  scorer: async (input: { graph: Node[] }) => {
    // Evaluate graph quality
    const coherenceScore = await evaluateCoherence(input.graph);
    const completenessScore = await evaluateCompleteness(input.graph);

    return {
      score: (coherenceScore + completenessScore) / 2,
      metrics: { coherenceScore, completenessScore }
    };
  }
});

// Run eval on generated graph
const result = await graphQualityEval.run({
  graph: generatedGraph
});
```

---

### 6. 📈 **Observability with OpenTelemetry** (LOW PRIORITY)

**Use Case:** Monitor workflow performance and LLM costs

**Benefits:**
- Track step execution times
- Monitor LLM token usage
- Identify bottlenecks in graph generation

**Already partially implemented via workflow step logging!**

---

### 7. 🎮 **Dev Playground** (LOW PRIORITY)

**Use Case:** Test and visualize workflows in browser

**Benefits:**
- Visual workflow debugging
- Interactive parameter tuning
- Real-time graph visualization

**Implementation:**
```bash
# Already available!
mastra dev
# Visit http://localhost:4111
```

---

## Implementation Roadmap

### Phase 1: Storage & Persistence (Week 1)
1. Add LibSQL/PostgreSQL storage
2. Implement graph persistence
3. Add list/retrieve endpoints
4. Store metadata (customer, product, timing)

### Phase 2: RAG & Semantic Search (Week 2)
1. Set up vector store (PgVector or Pinecone)
2. Embed nodes during generation
3. Implement semantic search API
4. Add "similar nodes" suggestions

### Phase 3: Enhanced Features (Week 3)
1. Add session memory for refinement
2. Implement agent-driven exploration
3. Add graph quality evals
4. Enable playground visualization

---

## Specific Feature: RAG-Based Node API

Here's a concrete example of how RAG could work:

### API: `POST /api/v1/nodes/rag-query`

**Request:**
```json
{
  "query": "How do companies validate synthetic data quality?",
  "topK": 5,
  "filters": {
    "domain": "AI/ML",
    "minScore": 0.7
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "nodeId": "synthetic-data-validation-c6edbd20",
      "content": "Synthetic data validation involves assessing...",
      "similarity": 0.92,
      "sourceGraph": "pearls-weave-20251012",
      "metadata": {
        "customer": "Pearls of Wisdom",
        "product": "W&B Weave"
      }
    },
    {
      "nodeId": "evaluation-metrics-a1b2c3",
      "content": "AI model evaluation uses various metrics...",
      "similarity": 0.87,
      "sourceGraph": "acme-datadog-20251011"
    }
  ]
}
```

**Use Cases:**
1. **Smart Expansion**: When generating children, query RAG for relevant existing nodes
2. **Graph Merging**: Find overlapping concepts between different graphs
3. **Quality Improvement**: Reuse high-quality nodes from previous graphs
4. **Knowledge Base**: Build a corpus of validated domain knowledge

---

## Database Schema Design

### Graph Storage

```sql
CREATE TABLE knowledge_graphs (
  id TEXT PRIMARY KEY,
  customer TEXT NOT NULL,
  product TEXT NOT NULL,
  nodes JSON NOT NULL,
  node_count INTEGER NOT NULL,
  generation_time_ms INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

CREATE INDEX idx_graphs_customer ON knowledge_graphs(customer);
CREATE INDEX idx_graphs_product ON knowledge_graphs(product);
CREATE INDEX idx_graphs_created ON knowledge_graphs(created_at DESC);
```

### Node Storage (for RAG)

```sql
CREATE TABLE knowledge_nodes (
  id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- for pgvector
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (graph_id) REFERENCES knowledge_graphs(id)
);

CREATE INDEX idx_nodes_embedding ON knowledge_nodes
  USING ivfflat (embedding vector_cosine_ops);
```

---

## Cost-Benefit Analysis

| Feature | Implementation Effort | Value Add | Priority |
|---------|---------------------|-----------|----------|
| Database Storage | Low (1 day) | High | ⭐⭐⭐ |
| RAG Search | Medium (3 days) | Very High | ⭐⭐⭐ |
| Memory/Sessions | Low (2 days) | Medium | ⭐⭐ |
| Agent Builder | High (5 days) | High | ⭐⭐ |
| Evals | Medium (2 days) | Medium | ⭐⭐ |
| Observability | Low (already done) | Medium | ⭐ |
| Playground | Low (already available) | Low | ⭐ |

---

## Recommended Next Steps

1. **Immediate**: Add database storage (LibSQL for simplicity)
2. **Next**: Implement RAG for node embeddings and semantic search
3. **Then**: Add session memory for iterative refinement
4. **Future**: Agent-driven graph building with tool calling

The combination of **database storage + RAG** would be transformative:
- Enable knowledge reuse across graphs
- Improve graph quality through semantic similarity
- Support new use cases (graph merging, smart suggestions)
- Build a valuable knowledge corpus over time

# Co-Dreamer: An AI That Dreams to Learn, Reason, and Act

**Co-Dreamer** is an end-to-end system where an AI agent passively learns and expands its own knowledge graph—a process we call "dreaming." It then uses this self-acquired, verified knowledge to perform complex reasoning tasks, like generating deeply personalized sales outreach that is continuously improved through a reinforcement learning loop.

> **Built for WeaveHacks 2025**, focusing on the **"Self-Improving Agents"** and **"Reinforcement Learning"** tracks.

---

## 🚀 Key Features & Technical Innovations

### Why Co-Dreamer is Different

Traditional AI systems are **reactive** and **context-limited**. They respond to prompts but don't learn autonomously, they rely on static RAG databases, and they can't improve from feedback. Co-Dreamer breaks this mold with a fundamentally different approach:

### 🧠 **1. Autonomous Knowledge Expansion ("Dreaming in the Cloud")**
**Conventional Approach:** Static knowledge bases, manual curation, retrieval from fixed datasets.

**Co-Dreamer's Innovation:**
- **Passive Learning**: The AI autonomously "dreams" new knowledge by exploring logical connections between concepts
- **Cloud-Native Execution**: Each dream runs in isolated Daytona cloud containers, enabling massive parallel processing
- **Generative Graph Building**: Uses LLMs to generate atomic, verifiable facts (nodes) and relationships (edges) in real-time
- **Multi-step Reasoning Paths**: Creates complex argument chains, not just single-hop associations
- **Breadth-First Exploration**: Systematically expands knowledge graphs level-by-level with configurable depth and branching

**Technical Implementation:**
```typescript
// Mastra workflow orchestrates BFS expansion
// Each generation creates N children per parent node
Generation 1: Customer → 2 nodes
Generation 2: 2 nodes → 4 nodes
Generation 3: 4 nodes → 8 nodes → Product
```

---

### ✅ **2. Real-Time Fact Verification**
**Conventional Approach:** Accept LLM hallucinations, post-hoc fact-checking, or no verification at all.

**Co-Dreamer's Innovation:**
- **Web-Grounded Truth**: Every single generated node is verified against live web search (Tavily)
- **Confidence Scoring**: Each fact gets a 0-1 confidence score with supporting sources
- **Hallucination Prevention**: Unverified knowledge is flagged or rejected before entering the graph
- **Citation Tracking**: Maintains source URLs for every piece of knowledge

**Technical Implementation:**
```typescript
// verification-service.ts
async verifyNode(content: string): VerificationResult {
  const searchResults = await tavily.search(content);
  return {
    verified: confidence > 0.7,
    confidence: score,
    sources: urls,
    summary: aiGeneratedExplanation
  };
}
```

---

### 🔄 **3. Closed-Loop Reinforcement Learning**
**Conventional Approach:** Static prompt engineering, A/B testing with manual analysis, no learning from outcomes.

**Co-Dreamer's Innovation:**
- **Online Learning**: The agent improves continuously from real-world feedback (email open rates, replies)
- **GRPO (Group Relative Policy Optimization)**: State-of-the-art RL algorithm for fine-tuning on trajectory outcomes
- **Graph-Based Reasoning**: Agent learns which argument paths are most persuasive, not just which words to use
- **Credit Assignment**: Nodes in successful email arguments get higher weights for future use

**Technical Implementation:**
```python
# ART (OpenPipe) RL pipeline
1. Generate K email trajectories by traversing KG
2. Score each trajectory with LLM Judge
3. Update agent policy with GRPO
4. Weight KG nodes by their contribution to high-scoring emails
```

---

### 🎯 **4. Graph-Structured RAG (Not Vector-Based)**
**Conventional Approach:** Vector embeddings, semantic similarity search, flat retrieval, no explicit reasoning chains.

**Co-Dreamer's Innovation:**
- **Explicit Reasoning Paths**: Every email argument follows a traceable path through the knowledge graph
- **Multi-hop Inference**: Supports complex arguments like "Customer needs X → X requires Y → Y is solved by Product"
- **Edge Semantics**: Relationships are typed (e.g., "creates challenge of", "addressed by") for interpretability
- **Pathfinding Algorithms**: Uses graph traversal (shortest path, BFS) to find optimal argument sequences

**Technical Implementation:**
```python
# Find persuasive paths from customer to product
paths = graph.find_all_paths(
    source="customer-job-node",
    target="product-feature-node",
    max_depth=5
)
# Agent explores paths to generate diverse email arguments
```

---

### 🔬 **5. Cloud-Native Isolated Execution (Dreaming in Containers)**
**Conventional Approach:** Run everything locally or in shared cloud instances, inconsistent environments, hard to debug.

**Co-Dreamer's Innovation:**
- **Daytona Cloud Containers**: Each "dream" runs in its own isolated cloud container with full execution environment
- **Ephemeral Workspaces**: Spin up, execute, and tear down in seconds—no server management
- **Checkpoint System**: Saves graph state at each generation for resume/rollback
- **Parallel Processing**: Scale to hundreds of concurrent dreams without local resource limits
- **Observable Logs**: Every step (LLM calls, verifications, graph updates) is logged to cloud workspace

**Technical Implementation:**
```typescript
// Each dream gets its own isolated cloud container
const workspace = await daytona.create(); // Spins up container in cloud
await workspace.exec("generate-graph");   // Runs in isolated environment
await workspace.saveCheckpoint("gen-3");  // Persists to cloud storage
// Auto-cleanup or keep for debugging
```

---

### 🎨 **6. Human-in-the-Loop Graph Editing with AI Agent**
**Conventional Approach:** Edit raw JSON, no visualization, batch operations require custom scripts.

**Co-Dreamer's Innovation:**
- **Natural Language Commands**: "Create a node about data privacy and connect it to synthetic-data-bias"
- **Batch Editing**: Single command updates dozens of nodes/edges simultaneously
- **Visual Feedback**: React Flow renders the graph in real-time with auto-layout
- **Bidirectional Sync**: UI changes update agent state, agent actions update UI instantly

**Technical Implementation:**
```typescript
// CopilotKit agent actions
useCopilotAction({
  name: "createNode",
  handler: async ({ content }) => {
    const node = { id: generateId(), content };
    setNodes([...nodes, node]);
    applyDagreLayout(); // Auto-arrange
  }
});
```

---

### 📊 **7. Full RL Pipeline Observability**
**Conventional Approach:** Black-box model training, logs scattered across files, hard to debug reward signals.

**Co-Dreamer's Innovation:**
- **W&B Weave Integration**: Every RL step is traced (trajectory generation, scoring, policy update)
- **Visual Dashboards**: See which KG paths lead to high-reward emails in real-time
- **Trajectory Comparison**: Compare multiple email drafts side-by-side with their scores
- **Reward Attribution**: Understand exactly why the agent chose specific nodes

**Technical Implementation:**
```python
@weave.op()
def generate_trajectory(kg, agent):
    path = agent.explore(kg)
    email = generate_email(path)
    score = judge.score(email)
    weave.log({"path": path, "email": email, "score": score})
    return email, score
```

---

### 🏗️ **8. Production-Ready Monorepo Architecture**
**Conventional Approach:** Separate repos for frontend/backend, manual API versioning, inconsistent tooling.

**Co-Dreamer's Innovation:**
- **Unified Codebase**: Frontend (TypeScript), KG Service (TypeScript/Mastra), RL Backend (Python) in one repo
- **Type-Safe APIs**: Shared TypeScript types between frontend and KG service
- **Consistent Dev Experience**: Single `npm install` + `uv sync` gets everything running
- **Microservices-Ready**: Each component can be deployed independently (Hono, FastAPI, Next.js)

---

## ✨ Our Sponsors & How We Used Their Tech

This project was made possible by leveraging the powerful tools provided by our sponsors. We integrated their technologies to build a robust, production-ready, and scalable AI system in just 48 hours.

| Sponsor | How We Used It | Learn More |
|---------|---------------|------------|
| **W&B Weave** | For end-to-end tracing and observability of our entire RL pipeline, from trajectory generation to reward scoring and model updates. | [W&B Weave Details](./WANDB_WEAVE.md) |
| **Mastra** | As the core TypeScript framework to orchestrate our complex, multi-step knowledge graph generation workflows and manage agent state. | [Mastra Usage](./mastra/README.md) |
| **Daytona** | To run each "dream" (KG generation) in isolated cloud containers—enabling truly parallel, scalable knowledge graph generation in the cloud without local resource constraints. | [daytona-service.ts](./mastra/src/dreamer/daytona-service.ts) |
| **AG-UI (CopilotKit)** | To build the interactive frontend, enabling real-time visualization of the knowledge graph and allowing users to edit the graph via a natural language chat agent. | [CopilotKit Integration](./COPILOTKIT.md) |
| **Tavily** | For real-time fact-checking of every piece of knowledge the AI "dreams" up, ensuring our knowledge graph is built on a foundation of truth. | [verification-service.ts](./mastra/src/dreamer/verification-service.ts) |
| **ART (from OpenPipe)** | As the serverless reinforcement learning framework to fine-tune our agent using Group Relative Policy Optimization (GRPO) on feedback from email performance. | [ART RL Details](./ART_RL.md) |
| **Google Cloud** | Powering our knowledge generation with the Gemini 2.5 Flash-Lite model for fast, cost-effective, and high-quality structured JSON output. | [llm-service.ts](./mastra/src/dreamer/llm-service.ts) |

---

## 🏛️ Architecture Overview

Co-Dreamer is a full-stack monorepo system composed of a frontend UI, a knowledge graph generation service, and a reinforcement learning backend.

```mermaid
graph TD
    subgraph Frontend [Frontend - codreamer-agui]
        A[Next.js + React Flow UI] -- Interacts with --> B[CopilotKit Agent];
        B -- Manages State & Actions --> A;
        A -- API Call --> D;
        A -- API Call --> E;
    end

    subgraph KGService [Knowledge Graph Service - mastra]
        D[Hono Server] -- Triggers --> D1[Mastra Workflow];
        D1 -- Runs in --> D2[Daytona Workspace];
        D2 -- Uses --> D3[Gemini AI];
        D2 -- Verifies with --> D4[Tavily API];
        D4 -- Returns --> D5[Verified Knowledge Graph JSON];
    end

    subgraph RLBackend [RL Backend - codreamer]
        E[FastAPI Server] -- Receives KG --> F[RL Pipeline];
        F -- 1. Generate Trajectories --> G[ART Agent];
        G -- Explores KG --> D5;
        F -- 2. Score Trajectories --> H[LLM Judge];
        F -- 3. GRPO Update --> G;
        F -- 4. Update KG Weights --> D5;
        F -- Traced by --> I[W&B Weave];
        F -- Returns --> J[Personalized Email];
    end

    J -- Webhook --> A;

    classDef sponsor fill:#6366f1,stroke:#4f46e5,color:#fff;
    class D1,D2,D3,D4,I,G,B sponsor;
```

---

## 🧠 Core Concepts

### 1. The "Dream": Knowledge Graph Generation in the Cloud

The process starts with a **"dream,"** where the system autonomously builds a knowledge graph.

- **Input**: A customer description (Customer Job) and a product description (Product Feature).
- **Process**: A Mastra workflow, running in an isolated Daytona cloud container, uses Gemini to generate new "nodes" (atomic facts) that logically connect the customer to the product.
- **Verification**: Each new node is fact-checked against the web using Tavily.
- **Output**: A JSON knowledge graph representing a verified, multi-step argument path.
- **Cloud Execution**: The entire dream runs in an ephemeral cloud container, enabling parallel processing of multiple knowledge graphs simultaneously.

### 2. The Action: Reinforcement Learning for Outreach

The generated knowledge graph is fed into a reinforcement learning pipeline to train an agent that crafts personalized sales emails.

- **Reasoning**: An ART (OpenPipe) agent explores the graph to find the most persuasive paths.
- **Training**: It generates multiple email variations (trajectories), which are scored by an LLM Judge. The agent is then updated via GRPO, learning which arguments are most effective.
- **Observability**: The entire learning loop is traced and visualized with W&B Weave.
- **Output**: A highly-personalized email with citations linking back to the facts in the knowledge graph.

### 3. The Interface: Human-in-the-Loop

The frontend, built with AG-UI (CopilotKit), allows a human to be in the loop.

- **Visualization**: The knowledge graph is rendered interactively using React Flow.
- **Interaction**: Users can talk to an agent to create, edit, or delete nodes and edges using natural language.
- **Workflow**: A multi-step UI guides the user from input, to KG refinement, to final email generation.

---

## 🚀 Getting Started

Co-Dreamer consists of **two separate services** that must be run concurrently: the backend (`codreamer`) and the frontend (`codreamer-agui`).

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.10+** and `uv` (or pip)
- An **OpenAI API Key**

### Step 1: Clone the Repository

```bash
# This monorepo contains both frontend and backend services.
git clone <your-repo-url>
cd co-dreamer
```

### Step 2: Set Up & Run the Backend (`codreamer`)

The backend handles the Reinforcement Learning pipeline.

```bash
# Navigate to the backend directory
cd codreamer

# Install dependencies using uv (recommended) or pip
uv sync
# or: pip install -e .

# Set up your environment variables
cp .env.example .env
# Add your OPENAI_API_KEY and optionally WANDB_API_KEY to the .env file

# Run the backend API server
uv run api
# The server will start on http://localhost:8000
```

**Keep this terminal running.**

### Step 3: Set Up & Run the Frontend (`codreamer-agui`)

The frontend contains the UI and the knowledge graph generation service (mastra).

```bash
# In a new terminal, navigate to the frontend directory
cd codreamer-agui

# Install dependencies
npm install

# Set up your environment variables
cp .env.example .env.local
# Add your NEXT_PUBLIC_CODREAMER_API_URL=http://localhost:8000
# And your Gemini/Tavily keys for the KG service

# Run the frontend development server
npm run dev
# The frontend will be available at http://localhost:3000
```

### Step 4: Run the Knowledge Graph Service (mastra)

The mastra service is automatically started by the frontend's Next.js server when you generate a knowledge graph. Ensure your `GEMINI_API_KEY` and `TAVILY_API_KEY` are in `.env.local`.

---

## 📖 User Flow & Example

1. **Open the App**: Navigate to http://localhost:3000.

2. **Step 1: Input Data**:
   - In the "Input Form" on the left, you'll see pre-filled descriptions for a customer ("Pearls of Wisdom") and a product ("W&B Weave").
   - Click the **"Generate KG"** button.

3. **The Dream Happens in the Cloud**:
   - The Mastra service spins up an isolated Daytona cloud container.
   - Inside the container, it calls Gemini to generate nodes and Tavily to verify them.
   - A knowledge graph will appear on the canvas, with nodes automatically arranged.
   - The container is automatically cleaned up after the dream completes.

4. **Step 2: Refine the Graph**:
   - Review the generated nodes. You can drag them, edit their content, or use the "Like/Dislike" buttons.
   - Open the chat panel on the right and ask the agent to make changes:
     - *"Create a new node about data privacy"*
     - *"Connect the 'data-privacy' node to 'synthetic-data-bias'"*

5. **Step 3: Generate the Email**:
   - Once you're happy with the graph, click the **"Generate Email"** button.
   - This sends the graph to the `codreamer` backend. The ART agent runs its RL pipeline, traced by W&B Weave.
   - After 30-60 seconds, a personalized email will appear in the "Email Summary" panel. The graph nodes will now show scores, indicating which facts were most influential.

6. **Self-Improvement**: You can continue to refine the graph and regenerate the email. With each iteration, the agent learns and improves.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js, React 19, React Flow, TypeScript, Tailwind CSS
- **AI Agent & UI**: AG-UI (CopilotKit)
- **Workflow Orchestration**: Mastra
- **Isolated Execution**: Daytona
- **Backend**: Python, FastAPI
- **Reinforcement Learning**: ART (OpenPipe)
- **Observability & Tracing**: W&B Weave
- **LLMs**: Google Gemini 2.5 Flash-Lite, OpenAI GPT-4o-mini
- **Fact-Checking**: Tavily Search API
- **Database**: LibSQL (for Mastra state)

---

## 💡 What is Co-Dreamer?

### Inspiration

Inspired by human dreaming as a mechanism for learning, we explored if an AI could "dream" to passively expand its knowledge. Our goal was to create a self-learning system that moves beyond simple Q&A to actively discover new logical connections. This "dreamed" knowledge is then used to generate highly nuanced, step-by-step arguments for complex tasks, far surpassing the output of standard generative models.

### What It Does

**CO-DREAMER** is an end-to-end system that enables an AI to learn, generate, and self-improve:

1. **Knowledge Graph "Dreaming" Module**: Passively expands a graph database by taking a starting concept (e.g., a company) and a topic (e.g., a product feature) to create new, atomic nodes and logical pathways.

2. **Personalized Outreach**: This expanded graph serves as a RAG source, generating multiple, unique email arguments by finding the shortest paths between a customer and a product.

3. **Interactive UI with Reinforcement Learning**: Enables innovative batch editing of all email versions with a single command via CopilotKit. Feedback from sent emails (e.g., open rates) creates a reinforcement learning loop, scoring the effectiveness of different "dreamed" argument paths.

### How We Built It

We architected a three-part system:

1. **Knowledge Graph Service**: Using a graph database with a backend API for pathfinding and RAG.
2. **Interactive UI**: Built in React, leveraging CopilotKit for the chat interface and parallel LLM calls for batch editing.
3. **Reinforcement Learning Pipeline**: Captures email performance data in a database to score and refine the knowledge graph paths over time, ensuring the system prioritizes the most effective strategies.

### Challenges We Ran Into

Our main challenge was constraining the "dream" to maintain relevance. Implementing the batch editing feature at scale was also a complex engineering feat.

### Accomplishments That We're Proud Of

We are proud of building a functional end-to-end system that demonstrates this novel learning process. The batch editing UI is a key innovation, offering a practical solution for managing AI-generated content at scale by combining automation with human oversight.

### What We Learned

We learned to use knowledge graphs as a superior, structured source for RAG. We also gained experience in guiding generative processes and building effective human-in-the-loop systems. This project proved the viability of creating a closed-loop AI application that transforms from a static tool into a dynamic, self-improving system based on real-world feedback.

---

## 🔮 What's Next for Co-Dreamer

- **Live Feedback Loop**: Integrate with marketing automation tools to use real email open/reply rates as the reward signal.
- **Deeper RAG**: Use Mastra RAG to find and reuse high-quality nodes from previously "dreamed" graphs.
- **Advanced Evals**: Implement Mastra Evals to automatically score graph quality on metrics like coherence, relevance, and diversity.
- **Autonomous Refinement**: Create an agent that can critique and refine its own knowledge graphs based on eval scores.
- **Scale the Platform**: Integrate with marketing automation tools for live feedback, and refine the RL model with more sophisticated reward functions like sentiment analysis of replies.
- **Adapt to Other Domains**: From generating personalized education plans to discovering novel scientific research pathways.

---

## 📄 License

See LICENSE file in project root.

---

## 🙏 Acknowledgments

Built with love for **WeaveHacks 2025**. Special thanks to all our sponsors for providing the incredible tools that made this project possible.

For issues or questions, please open an issue on GitHub.

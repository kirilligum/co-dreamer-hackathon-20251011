# CopilotKit Integration

## Overview

This project leverages **CopilotKit** as an end-to-end, agentic framework to power a conversational interface for saas email outreach generation.

## Frontend Architecture

The following diagram shows the complete frontend architecture in `codreamer-agui`:

```mermaid
flowchart TD
    Start([User Opens App]) --> CustomerPanel[Customer List Panel<br/>Multi-customer selection]
    CustomerPanel --> LoadState{Load Customer State}
    LoadState --> StepRouter{Current Step Router}

    StepRouter -->|Step 1| Step1Panel[Step 1: Input Form Panel]
    StepRouter -->|Step 2| Step2Panel[Step 2: KG Refinement Panel]
    StepRouter -->|Step 3| Step3Panel[Step 3: Email Summary Panel]

    Step1Panel --> FormNode[FormNode on Canvas<br/>Product + Customer descriptions]
    FormNode --> GenKGButton[Generate KG Button]
    GenKGButton --> GenKGAPI[API: POST /api/generate-kg<br/>Mastra workflow in Daytona]

    GenKGAPI --> MastraWorkflow[Mastra Workflow]
    MastraWorkflow --> GeminiGen[Gemini: BFS node generation]
    GeminiGen --> TavilyVerify[Tavily: Fact verification]
    TavilyVerify --> ReturnKG[Return KG JSON]

    ReturnKG --> CreateKGNodes[Create KnowledgeNodes on canvas]
    CreateKGNodes --> AgentStateUpdate1[Update AgentState<br/>nodes + edges]
    AgentStateUpdate1 --> Step2Panel

    Step2Panel --> ReactFlowCanvas[React Flow Canvas<br/>Visualize KG nodes/edges]
    ReactFlowCanvas --> UserInteraction{User Interaction}

    UserInteraction -->|Manual Edit| DirectEdit[Drag/edit nodes directly]
    UserInteraction -->|Chat Command| ChatPanel[CopilotKit Chat Panel]

    ChatPanel --> MastraAgent[Mastra Agent<br/>GPT-4o-mini + 12 actions]
    MastraAgent --> AgentActions{Choose Action}

    AgentActions -->|KG Actions| KGActions[7 KG Actions<br/>createNode, updateNode, deleteNode<br/>createEdge, updateEdge, deleteEdge<br/>likeNode]
    AgentActions -->|Workflow Actions| WorkflowActions[4 Workflow Actions<br/>generateKG, generateEmail<br/>updateFormFields, runAutopilot]
    AgentActions -->|Analytics Actions| AnalyticsActions[1 Analytics Action<br/>summarizePipeline]

    KGActions --> AgentStateUpdate2[Update AgentState<br/>via useCoAgent]
    WorkflowActions --> TriggerWorkflow[Trigger async workflow]
    AnalyticsActions --> ReadContext[Read useCopilotReadable<br/>contexts]

    TriggerWorkflow --> StateProtection{isGeneratingRef?}
    StateProtection -->|false| AllowGen[Allow generation]
    StateProtection -->|true| BlockGen[Block to prevent race condition]

    AllowGen --> GenEmailButton[Generate Email Button/Action]
    GenEmailButton --> GenEmailAPI[API: POST /learn-loop<br/>CoDreamer backend]

    GenEmailAPI --> RLPipeline[RL Pipeline]
    RLPipeline --> Step1RL[Step 1: Generate Trajectories<br/>Agent explores KG with tools]
    Step1RL --> Step2RL[Step 2: Score Trajectories<br/>RULER Judge + feedback]
    Step2RL --> Step3RL[Step 3: GRPO Update<br/>ART model.train]
    Step3RL --> Step4RL[Step 4: Update KG Weights<br/>Boost high-reward nodes]

    Step4RL --> ReturnEmail[Return email + node scores]
    ReturnEmail --> CreateEmailNode[Create EmailNode on canvas]
    CreateEmailNode --> UpdateNodeScores[Update nodeScores in AgentState]
    UpdateNodeScores --> Step3Panel

    DirectEdit --> AgentStateUpdate2
    AgentStateUpdate2 --> SyncToAgent[Bidirectional Sync<br/>useCoAgent hook]
    SyncToAgent --> ReactFlowCanvas

    ReadContext --> ReturnInsight[Return formatted insight]
    ReturnInsight --> ChatPanel

    Step3Panel --> EmailDisplay[Display email with citations]
    EmailDisplay --> HighlightNodes[Highlight high-scoring nodes<br/>on canvas]

    style Step1Panel fill:#e3f2fd
    style Step2Panel fill:#fff3e0
    style Step3Panel fill:#e8f5e9
    style MastraAgent fill:#9c27b0,color:#fff
    style RLPipeline fill:#6366f1,color:#fff
    style StateProtection fill:#ff9800,color:#fff
    style SyncToAgent fill:#00bcd4,color:#fff
```

### Key Components Explained

1. **Multi-Customer State Management**
   - Each customer has isolated `AgentState` in `customerStates` map
   - Switching customer loads their saved state via `useCoAgent`

2. **3-Step Workflow**
   - **Step 1**: Input form with product/customer descriptions
   - **Step 2**: KG refinement with React Flow canvas + chat editing
   - **Step 3**: Email summary with node score visualization

3. **CopilotKit Integration**
   - `useCoAgent`: Shared state between UI and Mastra agent
   - `useCopilotAction`: 12 actions (7 KG, 4 workflow, 1 analytics)
   - `useCopilotReadable`: 3 contexts (customer list, workflow states, pipeline stats)
   - `useCopilotAdditionalInstructions`: Dynamic workflow context

4. **State Protection**
   - `isGeneratingRef` prevents race conditions during long-running operations
   - Agent state updates are blocked while KG/email generation is in progress

5. **API Integration**
   - `/api/generate-kg`: Mastra workflow in Daytona (Gemini + Tavily)
   - `/learn-loop`: CoDreamer RL pipeline (ART + W&B Weave)

### Key Files

| File | Purpose |
|------|---------|
| `codreamer-agui/src/app/page.tsx` | Main frontend component with CopilotKit hooks |
| `codreamer-agui/src/app/api/agent/route.ts` | Mastra agent API endpoint |
| `codreamer-agui/src/app/api/generate-kg/route.ts` | KG generation API (calls Mastra workflow) |
| `codreamer-agui/src/components/Canvas.tsx` | React Flow canvas for KG visualization |
| `codreamer-agui/src/components/StepPanel.tsx` | Step-specific UI panels |
| `codreamer-agui/src/components/CustomerPanel.tsx` | Multi-customer selection sidebar |

## Key Features Enabled by CopilotKit

### 1. Chat-First Workflow Automation

### 2. Bulk Editing Knowledge Graph through Chat Interface

### 3. Executive Summaries & Analytics

### 4. Dynamic suggestions for each step

## Integration Summary

| CopilotKit Feature                   | Our Implementation                             | Benefit                               |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------- |
| **useCoAgent**                       | Shared `AgentState` with KG nodes/edges        | Real-time UI-agent synchronization    |
| **useCopilotAction**                 | 12 actions (KG editing + workflow + analytics) | Chat-controllable workflow automation |
| **useCopilotReadable**               | Customer pipeline + workflow states            | Agent has full context for insights   |
| **useCopilotAdditionalInstructions** | Dynamic workflow context                       | Agent adapts to current step          |
| **Mastra Agent**                     | GPT-4o-mini with working memory                | Stateful agent with 12-action toolkit |
| **Dynamic Suggestions**              | Step-specific onboarding prompts               | Self-guided user experience           |
| **State Protection**                 | Race condition prevention                      | Data integrity during generation      |

## Technical Architecture

### Mastra + CopilotKit Integration

```
┌─────────────────────────────────────────────────────────┐
│                    CopilotKit Runtime                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │          Mastra Agent (sample_agent)               │ │
│  │  • Model: GPT-4o-mini via OpenAI                   │ │
│  │  • Working Memory: AgentState schema (Zod)         │ │
│  │  • Instructions: 12 actions + pipeline visibility  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            ↕
            Bidirectional State Synchronization
                            ↕
┌─────────────────────────────────────────────────────────┐
│              React Frontend (Next.js)                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │  useCoAgent Hook                                   │ │
│  │  • Shared state: AgentState                        │ │
│  │  • Nodes: FormNode, KnowledgeNode, EmailNode      │ │
│  │  • Edges: KGEdge with relationship + rationale    │ │
│  │  • Per-customer workflow states                   │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  useCopilotAction (12 actions)                    │ │
│  │  • 7 KG actions (create/update/delete nodes/edges)│ │
│  │  • 4 workflow actions (generate KG/email, etc.)   │ │
│  │  • 1 analytics action (summarizePipeline)         │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  useCopilotReadable (3 readable contexts)         │ │
│  │  • Customer list with statuses                     │ │
│  │  • Per-customer workflow progress                  │ │
│  │  • Pipeline statistics & completion metrics        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Shared State Architecture

**`AgentState` (Zod Schema):**

```typescript
{
  nodes: CanvasNode[],        // FormNode | KnowledgeNode | EmailNode
  edges: KGEdge[],             // With relationship + rationale
  currentStep: 1 | 2 | 3,      // Workflow progress
  lastAction: string,           // Action tracking
  nodeScores?: Record<string, number>,  // CoDreamer backend scoring
  runId?: string,               // Backend run tracking
}
```

**Bidirectional sync via `useCoAgent`:**

- Frontend updates state → Agent sees changes immediately
- Agent modifies state → UI re-renders reactively
- State protection during generation prevents race conditions

### CopilotKit Hooks in Action

#### 1. `useCoAgent` - Shared State

```typescript
const { state, setState } = useCoAgent<AgentState>({
  name: "sample_agent",
  initialState,
});
```

Enables agent and UI to share the same knowledge graph state, with real-time synchronization.

#### 2. `useCopilotAction` - Agent Capabilities (12 Actions)

**Knowledge Graph Actions (7):**

```typescript
useCopilotAction({
  name: "createNode",
  description: "Create a new knowledge node",
  parameters: [{ name: "content", type: "string" }],
  handler: ({ content }) => {
    /* Create node logic */
  },
});
```

**Workflow Actions (4):**

- `generateKnowledgeGraph()` - Trigger KG generation from form
- `generateEmailDraft()` - Trigger email generation from KG
- `updateFormFields()` - Update product/customer descriptions
- `runAutopilot()` - Automated end-to-end workflow

**Analytics Actions (1):**

- `summarizePipeline()` - Comprehensive pipeline summary with metrics

#### 3. `useCopilotReadable` - Context for Agent

```typescript
useCopilotReadable({
  description: "List of all customers in the pipeline",
  value: customers.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    isSelected: c.id === selectedCustomerId,
  })),
});
```

Exposes customer data, workflow states, and completion metrics to the agent without explicit queries.

#### 4. `useCopilotAdditionalInstructions` - Dynamic Context

```typescript
useCopilotAdditionalInstructions({
  instructions: `
    CURRENT WORKFLOW STEP: ${viewState.currentStep} of 3
    Knowledge Nodes (${kgNodes.length}): ...
    Available Actions: createNode, generateKG, runAutopilot...
  `,
});
```

Provides real-time workflow context to the agent based on current state.

## Workflow Automation Examples

### Example 1: Autopilot Mode

**User:** "Run autopilot mode"

**What happens:**

1. Agent calls `runAutopilot()` action
2. Action validates form data
3. Calls `handleGenerateKG()` with await
4. Waits for React state propagation (2s)
5. Automatically calls `handleGenerateEmail()`
6. Returns status: "Autopilot activated! Generating KG first, then email..."

**User experience:** Single command triggers 60-90 second workflow that would normally require 2 button clicks + waiting.

### Example 2: Bulk Editing

**User:** "Update all nodes mentioning 'cost savings' to emphasize '30% ROI improvement'"

**What happens:**

1. Agent reads current KG state from shared state
2. Identifies relevant nodes using content search
3. Calls `updateNodeContent(nodeId, newContent)` for each match
4. UI updates reactively via state sync

**User experience:** Complex bulk operation completed in seconds via natural language.

### Example 3: Pipeline Analytics

**User:** "Give me a pipeline summary"

**What happens:**

1. Agent calls `summarizePipeline()` action
2. Action reads from `useCopilotReadable` contexts:
   - Customer list with statuses
   - Per-customer workflow states
   - Completion metrics
3. Generates formatted summary with:
   - Status breakdown (new/sent/opened/in convo)
   - Workflow progress distribution
   - Completion rates

**User experience:** Executive-level insights without leaving chat interface.

## State Protection & Race Condition Prevention

**Challenge:** When users generate email/KG while agent is responding to a query, agent's stale state could overwrite fresh data.

**Solution:** State protection using `isGeneratingRef`:

```typescript
// Block agent state updates during generation
useEffect(() => {
  if (isGeneratingRef.current) {
    console.log("[State Protection] Skipping agent state update");
    return;
  }
  // ... normal state sync
}, [state]);

// Set protection flag during generation
const handleGenerateEmail = async () => {
  isGeneratingRef.current = true; // START PROTECTION
  // ... generation logic (30-60s)
  isGeneratingRef.current = false; // END PROTECTION
};
```

This ensures data integrity during long-running operations.

## Multi-Customer Workflow Support

Each customer has isolated workflow state stored in `customerStates`:

```typescript
const [customerStates, setCustomerStates] = useState<
  Record<string, AgentState>
>({});

// Switch customer → Load their state
const handleSelectCustomer = (customerId) => {
  const savedState = customerStates[customerId] || initialState;
  setState(savedState);
};
```

Agent can access all customer data via `useCopilotReadable` to provide cross-customer insights.

## Dynamic Suggestions for Onboarding

CopilotKit's suggestion system adapts based on workflow step:

```typescript
<CopilotChat
  suggestions={(() => {
    if (viewState.currentStep === 1) {
      return [
        { title: "How does this work?", message: "Explain the workflow..." },
        { title: "Generate Knowledge Graph", message: "Generate the KG..." },
        { title: "Run Autopilot", message: "Run autopilot mode..." },
      ];
    }
    // ... step 2 & 3 suggestions
  })()}
/>
```

## Why CopilotKit?

CopilotKit enables our project to deliver a **co-creation experience** where:

1. **Users work naturally**: No need to learn complex UI—just describe intent
2. **AI has full context**: Shared state + readable contexts = intelligent assistance
3. **Workflows are streamlined**: Autopilot, bulk operations, and analytics via chat
4. **Onboarding is seamless**: Dynamic suggestions guide users through the process
5. **Integration is clean**: Mastra agent + CopilotKit hooks create a maintainable architecture

The result is an agentic application where the boundary between "using a tool" and "working with an AI colleague" disappears.

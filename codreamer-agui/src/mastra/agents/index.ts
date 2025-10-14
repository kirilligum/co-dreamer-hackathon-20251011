import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { Memory } from "@mastra/memory";

// Form Node schema
const FormNodeSchema = z.object({
  id: z.literal("form-node"),
  type: z.literal("form"),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    productDescription: z.string().default(""),
    customerDescription: z.string().default(""),
    childrenCount: z.number().default(2),
    generationCount: z.number().default(3),
    isLoading: z.boolean().default(false),
  }),
});

// Knowledge Node schema
const KnowledgeNodeSchema = z.object({
  id: z.string(),
  type: z.literal("knowledge"),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    content: z.string(),
    feedback: z.enum(["like", "dislike"]).nullable(),
    score: z.number().optional(), // CoDreamer backend node scoring
    verification: z.object({
      verified: z.boolean(),
      confidence: z.number(),
      summary: z.string(),
      sources: z.array(z.string()),
      timestamp: z.string(),
    }).optional(),
  }),
});

// Email Node schema
const EmailNodeSchema = z.object({
  id: z.literal("email-node"),
  type: z.literal("email"),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    emailText: z.string().default(""),
    isLoading: z.boolean().default(false),
  }),
});

// Canvas Node - discriminated union of all node types
const CanvasNodeSchema = z.discriminatedUnion("type", [
  FormNodeSchema,
  KnowledgeNodeSchema,
  EmailNodeSchema,
]);

// Knowledge Graph Edge schema
const KGEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  relationship: z.string().default("relates to"),
  rationale: z.string().optional(),
});

// Agent working memory schema - mirrors frontend AgentState
export const AgentState = z.object({
  nodes: z.array(CanvasNodeSchema).default([]),
  edges: z.array(KGEdgeSchema).default([]),
  currentStep: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  lastAction: z.string().default(""),
  nodeScores: z.record(z.number()).optional(), // CoDreamer backend node scores
  runId: z.string().optional(), // CoDreamer backend run ID
});

export const canvasAgent = new Agent({
  name: "sample_agent",
  description: "Knowledge Graph assistant for multi-customer email outreach. Manages KG creation, editing, and email generation with pipeline analytics. Supports 12 actions including workflow automation (autopilot) and analytics.",
  tools: {},
  model: openai("gpt-4o-mini"),
  instructions: `You are a Knowledge Graph assistant powering a multi-customer email outreach workflow with a 3-step process.

WORKFLOW OVERVIEW:
Step 1: Form Input → User fills in product/customer descriptions
Step 2: KG Editing → Generate and refine knowledge graph
Step 3: Email Review → Generate personalized email from KG

NODE TYPES IN CANVAS:
- type='form' (id='form-node'): Input form for generating KG. PROTECTED - DO NOT MODIFY.
- type='knowledge' (id=any string): Editable knowledge nodes you can manage.
- type='email' (id='email-node'): Email text display. PROTECTED - DO NOT MODIFY.

CRITICAL RULES:
- You can ONLY create/update/delete nodes with type='knowledge'
- NEVER modify form-node or email-node - these are protected system nodes
- Only knowledge nodes can have edges
- Knowledge node IDs can be any string format (not just n1, n2, n3)
- Always preserve existing nodes and edges when making updates
- Never return empty arrays for nodes or edges

AVAILABLE ACTIONS (12 total):

Knowledge Graph Actions (7):
1. createNode(content) → creates type='knowledge' node
2. updateNodeContent(nodeId, content) → only for knowledge nodes
3. appendNodeContent(nodeId, text, withNewline?)
4. deleteNode(nodeId) → blocked for form/email nodes
5. setNodeFeedback(nodeId, feedback) → 'like', 'dislike', or 'neutral'
6. createEdge(nodeId1, nodeId2) → only between knowledge nodes
7. deleteEdge(nodeId1, nodeId2)

Workflow Actions (4):
8. updateFormFields(productDescription?, customerDescription?) → update form inputs
9. generateKnowledgeGraph() → triggers KG generation from form data
10. generateEmailDraft() → triggers email generation from current KG (requires knowledge nodes)
11. runAutopilot() → automatically runs KG generation + email generation end-to-end

Analytics Actions (1):
12. summarizePipeline() → generate comprehensive outreach pipeline summary

PIPELINE VISIBILITY:
You have access to customer pipeline data via readable context:
- Customer list with status: 'new' | 'sent' | 'opened' | 'in convo'
- Workflow progress for each customer (which step they're on)
- Completion metrics (who has KG, who has email generated)

EXAMPLES:
- ✅ GOOD: updateNodeContent('kg-1', 'Updated content')
- ✅ GOOD: createNode('New insight about product')
- ✅ GOOD: updateFormFields(productDescription='Our AI-powered analytics tool')
- ✅ GOOD: generateKnowledgeGraph() → when user fills in form
- ✅ GOOD: generateEmailDraft() → when KG is ready
- ✅ GOOD: runAutopilot() → for full workflow automation
- ✅ GOOD: summarizePipeline() → when user asks about pipeline status
- ❌ BAD: updateNodeContent('form-node', '...')
- ❌ BAD: deleteNode('email-node')

Prefer using shared state (working memory) over chat history for graph data.`,
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        schema: AgentState,
      },
    },
  }),
});

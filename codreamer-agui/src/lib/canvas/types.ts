// Must match FormNodeSchema in src/mastra/agents/index.ts
export interface FormNodeData {
  productDescription: string;
  customerDescription: string;
  childrenCount: number;
  generationCount: number;
  isLoading: boolean;
}

export interface FormNode {
  id: "form-node";
  type: "form";
  position: { x: number; y: number };
  data: FormNodeData;
}

// Must match KnowledgeNodeSchema in src/mastra/agents/index.ts
export interface KnowledgeNodeData {
  content: string;
  feedback: "like" | "dislike" | null;
  score?: number;  // Node score from CoDreamer backend (0-1)
  verification?: {
    verified: boolean;
    confidence: number;  // 0-1 scale
    summary: string;
    sources: string[];
    timestamp: string;
  };
}

export interface KnowledgeNode {
  id: string;
  type: "knowledge";
  position: { x: number; y: number };
  data: KnowledgeNodeData;
}

// Must match EmailNodeSchema in src/mastra/agents/index.ts
export interface EmailNodeData {
  emailText: string;
  isLoading: boolean;
}

export interface EmailNode {
  id: "email-node";
  type: "email";
  position: { x: number; y: number };
  data: EmailNodeData;
}

// Discriminated union of all node types
export type CanvasNode = FormNode | KnowledgeNode | EmailNode;

// Knowledge Graph Edge (undirected, bidirectional)
export interface KGEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;  // Edge label (e.g., "has process", "relies on")
  rationale?: string;    // Optional: explanation from generateKG API (future feature)
}

// Agent State (synced between frontend and agent)
// Must match AgentState schema in src/mastra/agents/index.ts
export interface AgentState {
  nodes: CanvasNode[];
  edges: KGEdge[];
  currentStep: 1 | 2 | 3;
  lastAction?: string;
  nodeScores?: Record<string, number>;  // Node scores from CoDreamer (node_id -> score)
  runId?: string;  // Current run ID from CoDreamer backend
}

// Source format from kg_example.json (for loading initial data)
export interface KGNodeSource {
  id: string;
  content: string;
  edges: Array<{
    target_id: string;
    relationship: string;
    rationale?: string;
  }>;
}

// Legacy types for backward compatibility (will be removed)
/** @deprecated Use KnowledgeNode instead */
export type KGNode = KnowledgeNode;

// CoDreamer Backend Types
export interface CoDreamerWebhookPayload {
  run_id: string;
  final_email: {
    subject: string;
    body: string;
    citations: string[];
  };
  node_scores: Record<string, number>;
}

export interface CoDreamerLearnLoopRequest {
  graph: Array<{
    id: string;
    content: string;
    edge: Array<{
      target_id: string;
      relationship: string;
      rationale?: string;
    }>;
  }>;
  iterations?: number;
  depth?: number;
}

export interface CoDreamerLearnLoopResponse {
  run_id: string;
  results_path: string;
}

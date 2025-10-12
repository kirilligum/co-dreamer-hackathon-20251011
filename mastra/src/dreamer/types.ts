/**
 * Knowledge Graph Data Structures
 */

// Anchor node IDs (exact strings required for parsing by other services)
export const CUSTOMER_JOB_ID = "Customer Job";
export const PRODUCT_FEATURE_ID = "Product Feature";

export interface Edge {
  target_id: string;
  relationship: string;
  rationale: string;
}

export interface Node {
  id: string;
  content: string;
  edge: Edge[];
}

export interface DreamRequest {
  customer: string;
  product: string;
  children_count?: number;
  generations_count_int?: number;
}

export interface LLMGeneratedNode {
  new_node_id: string;
  new_node_content: string;
  relationship: string;
  rationale: string;
}

/**
 * Knowledge Graph Data Structures
 */

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

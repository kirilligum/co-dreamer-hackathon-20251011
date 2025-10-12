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

export interface DreamResponse {
  nodes: Node[];
  duration?: number;
}

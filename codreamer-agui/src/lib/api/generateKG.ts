import type { KnowledgeNode, FormNodeData } from '../canvas/types';

export interface GenerateKGRequest {
  productDescription: string;
  customerDescription: string;
  childrenCount: number;
  generationCount: number;
}

export interface GenerateKGResponse {
  nodes: KnowledgeNode[];
  edges: Array<{
    source: string;
    target: string;
    relationship: string;
    rationale?: string;
  }>;
}

/**
 * Helper function to convert KG data to frontend format
 */
function convertKGDataToResponse(kgData: any[]): GenerateKGResponse {
  // Convert KGNodeSource format to KnowledgeNode format
  // Note: Positions will be assigned by auto-layout in the caller
  const nodes: KnowledgeNode[] = kgData.map((kgNode: any) => ({
    id: kgNode.id,
    type: 'knowledge' as const,
    position: { x: 0, y: 0 }, // Will be overridden by layout
    data: {
      content: kgNode.content,
      feedback: null,
      verification: kgNode.verification ? {
        verified: kgNode.verification.verified,
        confidence: kgNode.verification.confidence,
        summary: kgNode.verification.summary,
        sources: kgNode.verification.sources || [],
        timestamp: kgNode.verification.timestamp,
      } : undefined,
    },
  }));

  // Extract edges from the format (handle both 'edge' and 'edges' properties)
  const edgeSet = new Set<string>();
  const edges: Array<{ source: string; target: string; relationship: string; rationale?: string }> = [];

  kgData.forEach((kgNode: any) => {
    const nodeEdges = kgNode.edge || kgNode.edges || [];
    nodeEdges.forEach((edge: any) => {
      // Create consistent ID (alphabetically sorted) to avoid duplicates
      const [id1, id2] = [kgNode.id, edge.target_id].sort();
      const edgeId = `${id1}-${id2}`;

      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        edges.push({
          source: kgNode.id,
          target: edge.target_id,
          relationship: edge.relationship,
          rationale: edge.rationale,
        });
      }
    });
  });

  return { nodes, edges };
}

/**
 * Generate knowledge graph from form data using the Knowledge Dreamer API
 * Falls back to mock data if API is unavailable
 */
export async function generateKG(formData: FormNodeData): Promise<GenerateKGResponse> {
  // Validate input
  if (!formData.productDescription.trim()) {
    throw new Error('Product description is required');
  }
  if (!formData.customerDescription.trim()) {
    throw new Error('Customer description is required');
  }

  // Try calling the real Dream API first
  try {
    console.log('[generateKG] Calling Dream API...');

    const response = await fetch('/api/generate-kg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productDescription: formData.productDescription,
        customerDescription: formData.customerDescription,
        children: formData.childrenCount,
        generations: formData.generationCount,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn('[generateKG] Dream API failed:', error);
      throw new Error(`Dream API error: ${error}`);
    }

    const kgData = await response.json();
    console.log('[generateKG] Dream API returned', kgData.length, 'nodes');

    return convertKGDataToResponse(kgData);

  } catch (error) {
    console.warn('[generateKG] Falling back to mock data:', error);

    // Fallback to mock data
    await new Promise(resolve => setTimeout(resolve, 2000));

    const response = await fetch('/kg_example.json');
    if (!response.ok) {
      throw new Error('Failed to load example KG data');
    }

    const kgData = await response.json();
    console.log('[generateKG] Using mock data:', kgData.length, 'nodes');

    return convertKGDataToResponse(kgData);
  }
}

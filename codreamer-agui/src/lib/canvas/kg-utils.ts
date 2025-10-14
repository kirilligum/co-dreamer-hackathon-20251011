import dagre from 'dagre';
import type { KGNode, KGEdge, AgentState, KGNodeSource } from './types';

/**
 * Load knowledge graph data from kg_example.json format
 * and convert to AgentState with auto-layout
 */
export function loadKGData(kgJson: KGNodeSource[]): AgentState {
  // 1. Extract edges (deduplicate bidirectional connections)
  const edgeSet = new Set<string>();
  const edges: KGEdge[] = [];

  kgJson.forEach(kgNode => {
    kgNode.edges.forEach(edge => {
      // Create consistent ID (alphabetically sorted)
      const [id1, id2] = [kgNode.id, edge.target_id].sort();
      const edgeId = `${id1}-${id2}`;

      // Only add if not already added
      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        edges.push({
          id: `e-${edgeId}`,
          source: kgNode.id,
          target: edge.target_id,
          relationship: edge.relationship,
          rationale: edge.rationale,
        });
      }
    });
  });

  // 2. Apply auto-layout
  const layoutResult = applyDagreLayout(kgJson, edges);

  // 3. Convert to KnowledgeNode format
  const nodes: KGNode[] = layoutResult.nodes.map(node => ({
    id: node.id,
    type: 'knowledge' as const,
    position: node.position,
    data: {
      content: node.content,
      feedback: null,
    },
  }));

  return {
    nodes,
    edges,
    currentStep: 2, // Loading KG means we're in step 2
    lastAction: "initial_load",
  };
}

/**
 * Auto-layout nodes using dagre algorithm
 */
export function applyDagreLayout(
  nodes: Array<{ id: string; content: string; edges: Array<{ target_id: string; relationship: string; rationale?: string }> }>,
  edges?: Array<{ source: string; target: string; relationship: string; rationale?: string }>
): { nodes: Array<{ id: string; content: string; position: { x: number; y: number }; feedback: null }>; edges: Array<{ source: string; target: string; relationship: string; rationale?: string }> } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure layout direction and spacing
  dagreGraph.setGraph({
    rankdir: 'TB',      // Top to bottom
    ranksep: 150,       // Vertical spacing between ranks (reduced for tighter layout)
    nodesep: 80,        // Horizontal spacing between nodes (reduced to keep narrow)
    edgesep: 50,        // Space for edges (reduced)
  });

  const nodeWidth = 400;   // Increased width for larger text
  const nodeHeight = 180;  // Reduced height with less padding

  // Add nodes to dagre graph
  nodes.forEach(node => {
    dagreGraph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  // Add edges to dagre graph (if provided)
  if (edges) {
    edges.forEach(edge => {
      dagreGraph.setEdge(edge.source, edge.target);
    });
  }

  // Run layout algorithm
  dagre.layout(dagreGraph);

  // Update node positions from dagre
  const layoutedNodes = nodes.map(node => {
    const position = dagreGraph.node(node.id);
    return {
      id: node.id,
      content: node.content,
      position: {
        x: position.x - nodeWidth / 2,  // Center node horizontally
        y: position.y - nodeHeight / 2, // Center node vertically
      },
      feedback: null,
    };
  });

  return { nodes: layoutedNodes, edges: edges ?? [] };
}

/**
 * Export AgentState back to kg_example.json format
 */
export function exportKGData(state: AgentState): KGNodeSource[] {
  // Filter to only knowledge nodes and create base nodes
  const knowledgeNodes = state.nodes.filter(n => n.type === 'knowledge') as KGNode[];
  const kgNodes: KGNodeSource[] = knowledgeNodes.map(node => ({
    id: node.id,
    content: node.data.content,
    edges: [],
  }));

  // Add edges back (bidirectional - add to both nodes)
  state.edges.forEach(edge => {
    const sourceNode = kgNodes.find(n => n.id === edge.source);
    const targetNode = kgNodes.find(n => n.id === edge.target);

    if (sourceNode) {
      sourceNode.edges.push({
        target_id: edge.target,
        relationship: edge.relationship,
        rationale: edge.rationale,
      });
    }
    if (targetNode) {
      targetNode.edges.push({
        target_id: edge.source,
        relationship: edge.relationship,
        rationale: edge.rationale,
      });
    }
  });

  return kgNodes;
}

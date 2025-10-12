import { Scorer } from '@mastra/evals';
import { Node } from './types';

/**
 * Custom scorers for evaluating knowledge graph quality
 */

// Type for graph evaluation input
export interface GraphEvalInput {
  nodes: Node[];
  customer: string;
  product: string;
  metadata?: {
    childrenCount?: number;
    generationsCount?: number;
    implementation?: 'workflow' | 'legacy';
  };
}

/**
 * Scorer: Graph Completeness
 * Measures if the graph has sufficient nodes and connections
 */
export const graphCompletenessScorer: Scorer<GraphEvalInput, number> = {
  name: 'graph_completeness',
  description: 'Measures the completeness of the knowledge graph based on node count and connectivity',

  async score(input: GraphEvalInput): Promise<number> {
    const { nodes } = input;

    // Minimum expected nodes
    const minExpectedNodes = 5;
    const idealNodes = 10;

    // Score based on node count (0-0.5)
    const nodeCountScore = Math.min(nodes.length / idealNodes, 1) * 0.5;

    // Count total edges
    const totalEdges = nodes.reduce((sum, node) => sum + (node.edge?.length || 0), 0);

    // Average edges per node (excluding Product Feature which is a sink)
    const nonSinkNodes = nodes.filter(n => n.id !== 'Product Feature');
    const avgEdgesPerNode = nonSinkNodes.length > 0
      ? totalEdges / nonSinkNodes.length
      : 0;

    // Score based on connectivity (0-0.5)
    // Ideal is 1-3 edges per node
    const connectivityScore = Math.min(avgEdgesPerNode / 2, 1) * 0.5;

    const finalScore = nodeCountScore + connectivityScore;

    console.log(`[Scorer:Completeness] Nodes: ${nodes.length}, Edges: ${totalEdges}, Score: ${finalScore.toFixed(3)}`);

    return finalScore;
  }
};

/**
 * Scorer: Node Quality
 * Evaluates the quality of node content (length, informativeness)
 */
export const nodeQualityScorer: Scorer<GraphEvalInput, number> = {
  name: 'node_quality',
  description: 'Evaluates the quality of individual node content',

  async score(input: GraphEvalInput): Promise<number> {
    const { nodes } = input;

    // Exclude anchor nodes from quality check
    const contentNodes = nodes.filter(
      n => n.id !== 'Customer Job' && n.id !== 'Product Feature'
    );

    if (contentNodes.length === 0) return 0;

    let totalScore = 0;

    for (const node of contentNodes) {
      let nodeScore = 0;

      // Content length check (ideal: 50-200 characters)
      const contentLength = node.content.length;
      if (contentLength >= 50 && contentLength <= 200) {
        nodeScore += 0.4;
      } else if (contentLength >= 30 && contentLength <= 300) {
        nodeScore += 0.2;
      }

      // Content has proper sentence structure
      if (node.content.includes('.') || node.content.includes(',')) {
        nodeScore += 0.2;
      }

      // Content is not just the ID
      if (node.content.toLowerCase() !== node.id.toLowerCase()) {
        nodeScore += 0.2;
      }

      // Content doesn't have obvious placeholders
      if (!node.content.includes('TODO') &&
          !node.content.includes('placeholder') &&
          !node.content.includes('...')) {
        nodeScore += 0.2;
      }

      totalScore += nodeScore;
    }

    const avgScore = totalScore / contentNodes.length;

    console.log(`[Scorer:Quality] Avg node quality: ${avgScore.toFixed(3)}`);

    return avgScore;
  }
};

/**
 * Scorer: Relationship Relevance
 * Checks if edge relationships and rationales are meaningful
 */
export const relationshipRelevanceScorer: Scorer<GraphEvalInput, number> = {
  name: 'relationship_relevance',
  description: 'Evaluates the relevance and quality of node relationships',

  async score(input: GraphEvalInput): Promise<number> {
    const { nodes } = input;

    const allEdges = nodes.flatMap(node =>
      (node.edge || []).map(edge => ({
        source: node.id,
        target: edge.target_id,
        relationship: edge.relationship,
        rationale: edge.rationale
      }))
    );

    if (allEdges.length === 0) return 0;

    let totalScore = 0;

    for (const edge of allEdges) {
      let edgeScore = 0;

      // Has a relationship type
      if (edge.relationship && edge.relationship.length > 0) {
        edgeScore += 0.25;
      }

      // Has a rationale
      if (edge.rationale && edge.rationale.length > 10) {
        edgeScore += 0.25;
      }

      // Rationale is substantial (> 50 chars)
      if (edge.rationale && edge.rationale.length > 50) {
        edgeScore += 0.25;
      }

      // Rationale mentions customer or product (context-aware)
      if (edge.rationale &&
          (edge.rationale.toLowerCase().includes('customer') ||
           edge.rationale.toLowerCase().includes('product'))) {
        edgeScore += 0.25;
      }

      totalScore += edgeScore;
    }

    const avgScore = totalScore / allEdges.length;

    console.log(`[Scorer:Relationships] Avg relationship quality: ${avgScore.toFixed(3)}`);

    return avgScore;
  }
};

/**
 * Scorer: Graph Diversity
 * Measures variety in node topics and relationship types
 */
export const graphDiversityScorer: Scorer<GraphEvalInput, number> = {
  name: 'graph_diversity',
  description: 'Measures the diversity of topics and relationships in the graph',

  async score(input: GraphEvalInput): Promise<number> {
    const { nodes } = input;

    // Get unique relationship types
    const relationshipTypes = new Set<string>();
    nodes.forEach(node => {
      node.edge?.forEach(edge => {
        if (edge.relationship) {
          relationshipTypes.add(edge.relationship.toLowerCase());
        }
      });
    });

    // Score based on relationship diversity (0-0.5)
    // Ideal: 3+ unique relationship types
    const relationshipDiversityScore = Math.min(relationshipTypes.size / 3, 1) * 0.5;

    // Check for keyword diversity in content (0-0.5)
    const allWords = nodes
      .map(n => n.content.toLowerCase())
      .join(' ')
      .split(/\s+/)
      .filter(w => w.length > 4); // Words longer than 4 chars

    const uniqueWords = new Set(allWords);
    const wordDiversityRatio = uniqueWords.size / Math.max(allWords.length, 1);

    const wordDiversityScore = Math.min(wordDiversityRatio * 2, 1) * 0.5;

    const finalScore = relationshipDiversityScore + wordDiversityScore;

    console.log(`[Scorer:Diversity] Unique relationships: ${relationshipTypes.size}, Word diversity: ${wordDiversityRatio.toFixed(3)}, Score: ${finalScore.toFixed(3)}`);

    return finalScore;
  }
};

/**
 * Scorer: Path to Product
 * Checks if all nodes have a path to the Product Feature
 */
export const pathToProductScorer: Scorer<GraphEvalInput, number> = {
  name: 'path_to_product',
  description: 'Verifies that all nodes connect to the Product Feature anchor',

  async score(input: GraphEvalInput): Promise<number> {
    const { nodes } = input;

    // Build adjacency map
    const adjacencyMap = new Map<string, Set<string>>();

    nodes.forEach(node => {
      if (!adjacencyMap.has(node.id)) {
        adjacencyMap.set(node.id, new Set());
      }

      node.edge?.forEach(edge => {
        adjacencyMap.get(node.id)!.add(edge.target_id);
      });
    });

    // BFS to find nodes that can reach Product Feature
    const canReachProduct = new Set<string>();
    canReachProduct.add('Product Feature');

    let changed = true;
    while (changed) {
      changed = false;

      for (const [nodeId, targets] of adjacencyMap.entries()) {
        if (!canReachProduct.has(nodeId)) {
          for (const target of targets) {
            if (canReachProduct.has(target)) {
              canReachProduct.add(nodeId);
              changed = true;
              break;
            }
          }
        }
      }
    }

    const reachableCount = canReachProduct.size;
    const totalNodes = nodes.length;

    const score = reachableCount / Math.max(totalNodes, 1);

    console.log(`[Scorer:PathToProduct] ${reachableCount}/${totalNodes} nodes can reach Product Feature, Score: ${score.toFixed(3)}`);

    return score;
  }
};

/**
 * Combined scorer that averages all individual scores
 */
export const overallGraphQualityScorer: Scorer<GraphEvalInput, number> = {
  name: 'overall_graph_quality',
  description: 'Combined score averaging all graph quality metrics',

  async score(input: GraphEvalInput): Promise<number> {
    const scores = await Promise.all([
      graphCompletenessScorer.score(input),
      nodeQualityScorer.score(input),
      relationshipRelevanceScorer.score(input),
      graphDiversityScorer.score(input),
      pathToProductScorer.score(input),
    ]);

    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    console.log(`[Scorer:Overall] Combined score: ${avgScore.toFixed(3)}`);

    return avgScore;
  }
};

// Export all scorers as a collection
export const allGraphScorers = [
  graphCompletenessScorer,
  nodeQualityScorer,
  relationshipRelevanceScorer,
  graphDiversityScorer,
  pathToProductScorer,
  overallGraphQualityScorer,
];

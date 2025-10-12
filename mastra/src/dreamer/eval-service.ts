import { Eval } from '@mastra/evals';
import {
  allGraphScorers,
  GraphEvalInput,
  graphCompletenessScorer,
  nodeQualityScorer,
  relationshipRelevanceScorer,
  graphDiversityScorer,
  pathToProductScorer,
  overallGraphQualityScorer,
} from './graph-scorers';
import { Node } from './types';

export interface GraphEvalResult {
  scores: {
    completeness: number;
    quality: number;
    relationships: number;
    diversity: number;
    pathToProduct: number;
    overall: number;
  };
  summary: {
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  metadata: {
    nodeCount: number;
    edgeCount: number;
    avgEdgesPerNode: number;
  };
}

export class GraphEvalService {
  /**
   * Evaluate a knowledge graph using all available scorers
   */
  async evaluateGraph(params: {
    nodes: Node[];
    customer: string;
    product: string;
    metadata?: {
      childrenCount?: number;
      generationsCount?: number;
      implementation?: 'workflow' | 'legacy';
    };
  }): Promise<GraphEvalResult> {
    console.log('[Eval] Starting graph evaluation...');

    const input: GraphEvalInput = {
      nodes: params.nodes,
      customer: params.customer,
      product: params.product,
      metadata: params.metadata,
    };

    // Run all scorers
    const [
      completeness,
      quality,
      relationships,
      diversity,
      pathToProduct,
      overall,
    ] = await Promise.all([
      graphCompletenessScorer.score(input),
      nodeQualityScorer.score(input),
      relationshipRelevanceScorer.score(input),
      graphDiversityScorer.score(input),
      pathToProductScorer.score(input),
      overallGraphQualityScorer.score(input),
    ]);

    const scores = {
      completeness,
      quality,
      relationships,
      diversity,
      pathToProduct,
      overall,
    };

    // Calculate metadata
    const edgeCount = params.nodes.reduce((sum, node) => sum + (node.edge?.length || 0), 0);
    const avgEdgesPerNode = params.nodes.length > 0 ? edgeCount / params.nodes.length : 0;

    const metadata = {
      nodeCount: params.nodes.length,
      edgeCount,
      avgEdgesPerNode,
    };

    // Generate summary
    const summary = this.generateSummary(scores, metadata);

    console.log('[Eval] Evaluation complete');
    console.log(`[Eval] Overall Score: ${(overall * 100).toFixed(1)}% (Grade: ${summary.grade})`);

    return {
      scores,
      summary,
      metadata,
    };
  }

  /**
   * Compare two graphs and return comparative analysis
   */
  async compareGraphs(params: {
    graph1: {
      nodes: Node[];
      customer: string;
      product: string;
      metadata?: any;
      label: string;
    };
    graph2: {
      nodes: Node[];
      customer: string;
      product: string;
      metadata?: any;
      label: string;
    };
  }): Promise<{
    graph1: GraphEvalResult;
    graph2: GraphEvalResult;
    comparison: {
      winner: string;
      scoreDifferences: {
        [key: string]: {
          graph1: number;
          graph2: number;
          difference: number;
          percentChange: number;
        };
      };
      insights: string[];
    };
  }> {
    console.log(`[Eval] Comparing "${params.graph1.label}" vs "${params.graph2.label}"`);

    const [result1, result2] = await Promise.all([
      this.evaluateGraph(params.graph1),
      this.evaluateGraph(params.graph2),
    ]);

    // Calculate score differences
    const scoreDifferences: any = {};
    const scoreKeys = Object.keys(result1.scores) as Array<keyof typeof result1.scores>;

    for (const key of scoreKeys) {
      const score1 = result1.scores[key];
      const score2 = result2.scores[key];
      const diff = score2 - score1;
      const percentChange = score1 > 0 ? (diff / score1) * 100 : 0;

      scoreDifferences[key] = {
        graph1: score1,
        graph2: score2,
        difference: diff,
        percentChange,
      };
    }

    const winner = result1.scores.overall > result2.scores.overall
      ? params.graph1.label
      : result2.scores.overall > result1.scores.overall
      ? params.graph2.label
      : 'Tie';

    // Generate insights
    const insights = this.generateComparisonInsights(
      scoreDifferences,
      params.graph1.label,
      params.graph2.label
    );

    console.log(`[Eval] Winner: ${winner}`);

    return {
      graph1: result1,
      graph2: result2,
      comparison: {
        winner,
        scoreDifferences,
        insights,
      },
    };
  }

  /**
   * Generate a summary based on scores
   */
  private generateSummary(
    scores: GraphEvalResult['scores'],
    metadata: GraphEvalResult['metadata']
  ): GraphEvalResult['summary'] {
    const { overall, completeness, quality, relationships, diversity, pathToProduct } = scores;

    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (overall >= 0.9) grade = 'A';
    else if (overall >= 0.8) grade = 'B';
    else if (overall >= 0.7) grade = 'C';
    else if (overall >= 0.6) grade = 'D';
    else grade = 'F';

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    // Analyze completeness
    if (completeness >= 0.8) {
      strengths.push('Graph has good size and connectivity');
    } else if (completeness < 0.5) {
      weaknesses.push('Graph is too small or poorly connected');
      recommendations.push('Increase generations_count or children_count to expand the graph');
    }

    // Analyze quality
    if (quality >= 0.8) {
      strengths.push('Node content is high quality and informative');
    } else if (quality < 0.5) {
      weaknesses.push('Node content quality needs improvement');
      recommendations.push('Review node generation prompts to produce more detailed content');
    }

    // Analyze relationships
    if (relationships >= 0.8) {
      strengths.push('Relationships are well-defined with strong rationales');
    } else if (relationships < 0.5) {
      weaknesses.push('Relationship rationales are weak or missing');
      recommendations.push('Improve edge generation to include contextual rationales');
    }

    // Analyze diversity
    if (diversity >= 0.8) {
      strengths.push('Graph shows good topic and relationship diversity');
    } else if (diversity < 0.5) {
      weaknesses.push('Graph lacks diversity in topics or relationships');
      recommendations.push('Encourage more varied exploration paths in the generation');
    }

    // Analyze path to product
    if (pathToProduct >= 0.9) {
      strengths.push('All nodes properly connect to the Product Feature');
    } else if (pathToProduct < 0.8) {
      weaknesses.push('Some nodes are disconnected from the Product Feature');
      recommendations.push('Ensure the final connection step properly links all leaf nodes');
    }

    return {
      grade,
      strengths,
      weaknesses,
      recommendations,
    };
  }

  /**
   * Generate comparison insights
   */
  private generateComparisonInsights(
    scoreDiffs: any,
    label1: string,
    label2: string
  ): string[] {
    const insights: string[] = [];

    // Find biggest improvements and regressions
    const entries = Object.entries(scoreDiffs) as Array<[string, any]>;
    const sorted = entries.sort((a, b) => Math.abs(b[1].difference) - Math.abs(a[1].difference));

    for (const [metric, data] of sorted.slice(0, 3)) {
      const { difference, percentChange } = data;

      if (Math.abs(difference) < 0.05) continue; // Skip negligible differences

      const better = difference > 0 ? label2 : label1;
      const worse = difference > 0 ? label1 : label2;

      insights.push(
        `${better} scores ${Math.abs(percentChange).toFixed(1)}% higher on ${metric} ` +
        `(${Math.abs(difference).toFixed(3)} point improvement)`
      );
    }

    if (insights.length === 0) {
      insights.push('Graphs have very similar performance across all metrics');
    }

    return insights;
  }
}

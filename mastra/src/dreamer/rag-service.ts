import { createRAG } from '@mastra/rag';
import { createEmbeddings } from '@mastra/rag';
import { createVectorStore } from '@mastra/rag';
import OpenAI from 'openai';
import { Node } from './types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface NodeSearchResult {
  node: Node;
  score: number;
  graphId: string;
  customer: string;
  product: string;
}

export interface EmbeddedNode {
  id: string;
  graphId: string;
  nodeId: string;
  content: string;
  embedding: number[];
  metadata: {
    customer: string;
    product: string;
    nodeIndex: number;
  };
}

export class RAGService {
  private openai: OpenAI;
  private embeddingModel = 'text-embedding-3-small';
  private vectorDimension = 1536; // text-embedding-3-small dimension

  // In-memory vector store for simplicity
  // In production, this should use a persistent vector database
  private vectors: Map<string, EmbeddedNode> = new Map();

  constructor() {
    if (!OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY environment variable is not set. " +
        "Please create a .env file with your OpenAI API key or set it in your environment."
      );
    }
    this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  /**
   * Generate embedding for a text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[RAG] Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Index nodes from a graph for semantic search
   */
  async indexGraph(params: {
    graphId: string;
    customer: string;
    product: string;
    nodes: Node[];
  }): Promise<void> {
    console.log(`[RAG] Indexing ${params.nodes.length} nodes from graph ${params.graphId}`);

    const startTime = Date.now();

    // Process nodes in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < params.nodes.length; i += batchSize) {
      const batch = params.nodes.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (node, batchIndex) => {
          const nodeIndex = i + batchIndex;
          const embedding = await this.generateEmbedding(node.content);

          const embeddedNode: EmbeddedNode = {
            id: `${params.graphId}:${node.id}`,
            graphId: params.graphId,
            nodeId: node.id,
            content: node.content,
            embedding,
            metadata: {
              customer: params.customer,
              product: params.product,
              nodeIndex,
            },
          };

          this.vectors.set(embeddedNode.id, embeddedNode);
          console.log(`[RAG] Indexed node ${nodeIndex + 1}/${params.nodes.length}: ${node.id}`);
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < params.nodes.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[RAG] Indexed ${params.nodes.length} nodes in ${duration}ms`);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Search for nodes semantically similar to a query
   */
  async searchNodes(params: {
    query: string;
    limit?: number;
    customer?: string;
    product?: string;
    minScore?: number;
  }): Promise<NodeSearchResult[]> {
    const { query, limit = 10, customer, product, minScore = 0.5 } = params;

    console.log(`[RAG] Searching for: "${query}"`);
    console.log(`[RAG] Filters - customer: ${customer || 'any'}, product: ${product || 'any'}`);

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Calculate similarity scores for all vectors
    const results: Array<{
      embeddedNode: EmbeddedNode;
      score: number;
    }> = [];

    for (const [id, embeddedNode] of this.vectors.entries()) {
      // Apply filters
      if (customer && !embeddedNode.metadata.customer.toLowerCase().includes(customer.toLowerCase())) {
        continue;
      }
      if (product && !embeddedNode.metadata.product.toLowerCase().includes(product.toLowerCase())) {
        continue;
      }

      // Calculate similarity
      const score = this.cosineSimilarity(queryEmbedding, embeddedNode.embedding);

      // Apply minimum score threshold
      if (score >= minScore) {
        results.push({ embeddedNode, score });
      }
    }

    // Sort by score descending and take top N
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);

    console.log(`[RAG] Found ${topResults.length} results (from ${results.length} candidates)`);

    // Convert to NodeSearchResult format
    return topResults.map(({ embeddedNode, score }) => ({
      node: {
        id: embeddedNode.nodeId,
        content: embeddedNode.content,
        edge: [], // Edges not stored in embeddings
      },
      score,
      graphId: embeddedNode.graphId,
      customer: embeddedNode.metadata.customer,
      product: embeddedNode.metadata.product,
    }));
  }

  /**
   * Remove all indexed nodes for a specific graph
   */
  async removeGraph(graphId: string): Promise<void> {
    let removedCount = 0;

    for (const [id, embeddedNode] of this.vectors.entries()) {
      if (embeddedNode.graphId === graphId) {
        this.vectors.delete(id);
        removedCount++;
      }
    }

    console.log(`[RAG] Removed ${removedCount} nodes from graph ${graphId}`);
  }

  /**
   * Get statistics about indexed nodes
   */
  getStats(): {
    totalNodes: number;
    totalGraphs: number;
    graphBreakdown: Map<string, number>;
  } {
    const graphCounts = new Map<string, number>();

    for (const embeddedNode of this.vectors.values()) {
      const count = graphCounts.get(embeddedNode.graphId) || 0;
      graphCounts.set(embeddedNode.graphId, count + 1);
    }

    return {
      totalNodes: this.vectors.size,
      totalGraphs: graphCounts.size,
      graphBreakdown: graphCounts,
    };
  }

  /**
   * Clear all indexed nodes
   */
  clear(): void {
    const prevSize = this.vectors.size;
    this.vectors.clear();
    console.log(`[RAG] Cleared ${prevSize} indexed nodes`);
  }
}

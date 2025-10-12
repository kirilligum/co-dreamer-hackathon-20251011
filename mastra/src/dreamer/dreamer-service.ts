import { Node, Edge, DreamRequest, LLMGeneratedNode } from "./types";
import { LLMService } from "./llm-service";
import { randomUUID } from "crypto";

export class DreamerService {
  private llmService: LLMService;
  private graphStore: Map<string, Node>;

  constructor() {
    this.llmService = new LLMService();
    this.graphStore = new Map();
  }

  /**
   * Main method to execute the BFS-based knowledge graph expansion
   */
  async dream(request: DreamRequest): Promise<Node[]> {
    const {
      customer,
      product,
      children_count = 2,
      generations_count_int = 3,
    } = request;

    // Reset graph store for this request
    this.graphStore.clear();

    // Step 1: Initialize with root node
    const rootNode: Node = {
      id: "root",
      content: customer,
      edge: [],
    };
    this.graphStore.set(rootNode.id, rootNode);

    // Step 2: Initialize BFS queue
    let queue: Node[] = [rootNode];
    let currentGeneration = 0;

    // Step 3: BFS Expansion Loop
    while (currentGeneration < generations_count_int && queue.length > 0) {
      console.log(`Processing generation ${currentGeneration + 1}/${generations_count_int} with ${queue.length} nodes`);

      const nextGenerationQueue: Node[] = [];

      // Process all nodes in current generation
      for (const currentNode of queue) {
        try {
          // Generate children nodes using LLM
          const generatedNodes = await this.llmService.generateNodes(
            customer,
            product,
            currentNode.content,
            children_count
          );

          // Process each generated child
          for (const generated of generatedNodes) {
            // Create new child node
            const childNode: Node = {
              id: this.generateNodeId(generated.new_node_id),
              content: generated.new_node_content,
              edge: [],
            };

            // Create edge from current node to child
            const edge: Edge = {
              target_id: childNode.id,
              relationship: generated.relationship,
              rationale: generated.rationale,
            };

            // Add edge to current node
            currentNode.edge.push(edge);

            // Add child node to graph store
            this.graphStore.set(childNode.id, childNode);

            // Add child to next generation queue
            nextGenerationQueue.push(childNode);

            console.log(`  Created node: ${childNode.id} -> ${generated.new_node_id}`);
          }
        } catch (error) {
          console.error(`Error processing node ${currentNode.id}:`, error);
          // Continue with next node even if one fails
        }
      }

      // Move to next generation
      queue = nextGenerationQueue;
      currentGeneration++;
    }

    // Step 4: Return the graph as an array
    return Array.from(this.graphStore.values());
  }

  /**
   * Generate a unique node ID based on the descriptive name
   */
  private generateNodeId(descriptiveName: string): string {
    // Create a sanitized ID from the descriptive name
    const sanitized = descriptiveName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);

    // Add a short UUID suffix to ensure uniqueness
    const suffix = randomUUID().substring(0, 8);

    return `${sanitized}-${suffix}`;
  }
}

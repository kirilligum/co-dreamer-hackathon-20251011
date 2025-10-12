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
    let lastGenerationNodes: Node[] = [];

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
      lastGenerationNodes = nextGenerationQueue;
      currentGeneration++;
    }

    // Step 4: Create product node and connect all final generation nodes to it
    const productNode: Node = {
      id: "product",
      content: product,
      edge: [],
    };
    this.graphStore.set(productNode.id, productNode);

    // Connect all leaf nodes (final generation) to the product node
    console.log(`Connecting ${lastGenerationNodes.length} final nodes to product`);
    for (const leafNode of lastGenerationNodes) {
      try {
        // Generate connection from leaf node to product using LLM
        const connectionNodes = await this.llmService.generateNodes(
          customer,
          product,
          leafNode.content,
          1 // Generate just 1 connection to product
        );

        if (connectionNodes.length > 0) {
          const connection = connectionNodes[0];
          const edge: Edge = {
            target_id: productNode.id,
            relationship: connection.relationship,
            rationale: connection.rationale,
          };
          leafNode.edge.push(edge);
          console.log(`  Connected ${leafNode.id} -> product`);
        }
      } catch (error) {
        console.error(`Error connecting ${leafNode.id} to product:`, error);
        // Create a fallback connection
        const edge: Edge = {
          target_id: productNode.id,
          relationship: "enables",
          rationale: "This concept connects to and enables the use of the product.",
        };
        leafNode.edge.push(edge);
      }
    }

    // Step 5: Return the graph as an array
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

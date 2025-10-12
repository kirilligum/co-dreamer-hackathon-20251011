import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { LLMService } from './llm-service';
import { Node, Edge, CUSTOMER_JOB_ID, PRODUCT_FEATURE_ID } from './types';
import { v4 as uuidv4 } from 'uuid';

// Input schema for the workflow
const dreamInputSchema = z.object({
  customer: z.string().describe('Description of the customer/company to analyze'),
  product: z.string().describe('Description of the product to explore towards'),
  children_count: z.number().default(2).describe('Number of child nodes per parent'),
  generations_count_int: z.number().default(3).describe('Number of expansion levels'),
});

// Output schema
const dreamOutputSchema = z.object({
  nodes: z.array(z.any()),
  metadata: z.object({
    totalNodes: z.number(),
    generationTime: z.number(),
    generations: z.number(),
  }),
});

// Step 1: Initialize anchor nodes
const initializeAnchors = createStep({
  id: 'initialize-anchors',
  description: 'Create Customer Job and Product Feature anchor nodes',
  inputSchema: dreamInputSchema,
  outputSchema: z.object({
    customer: z.string(),
    product: z.string(),
    children_count: z.number(),
    generations_count_int: z.number(),
    nodes: z.array(z.any()),
    nodeMap: z.record(z.any()),
  }),
  execute: async ({ inputData }) => {
    console.log('[Step 1] Initializing anchor nodes...');

    const customerNode: Node = {
      id: CUSTOMER_JOB_ID,
      content: inputData.customer,
      edge: [],
    };

    const productNode: Node = {
      id: PRODUCT_FEATURE_ID,
      content: inputData.product,
      edge: [],
    };

    const nodes = [customerNode, productNode];
    const nodeMap: Record<string, Node> = {
      [CUSTOMER_JOB_ID]: customerNode,
      [PRODUCT_FEATURE_ID]: productNode,
    };

    console.log(`[Step 1] Created anchor nodes: "${CUSTOMER_JOB_ID}" and "${PRODUCT_FEATURE_ID}"`);

    return {
      ...inputData,
      nodes,
      nodeMap,
    };
  },
});

// Step 2: BFS Expansion (multiple generations)
const expandGraph = createStep({
  id: 'expand-graph',
  description: 'Expand knowledge graph using BFS algorithm',
  inputSchema: z.object({
    customer: z.string(),
    product: z.string(),
    children_count: z.number(),
    generations_count_int: z.number(),
    nodes: z.array(z.any()),
    nodeMap: z.record(z.any()),
  }),
  outputSchema: z.object({
    nodes: z.array(z.any()),
    nodeMap: z.record(z.any()),
    totalGenerated: z.number(),
  }),
  execute: async ({ inputData }) => {
    console.log('[Step 2] Expanding graph with BFS...');

    const llmService = new LLMService();
    const { customer, product, children_count, generations_count_int, nodes, nodeMap } = inputData;

    let queue = [CUSTOMER_JOB_ID];
    let totalGenerated = 0;

    for (let generation = 0; generation < generations_count_int; generation++) {
      console.log(`[Step 2] Generation ${generation + 1}/${generations_count_int} - Processing ${queue.length} nodes`);

      const nextQueue: string[] = [];

      for (const parentId of queue) {
        const parentNode = nodeMap[parentId];

        try {
          const generatedNodes = await llmService.generateNodes(
            customer,
            product,
            parentNode.content,
            children_count
          );

          for (const genNode of generatedNodes) {
            const childId = `${genNode.new_node_id.toLowerCase().replace(/\s+/g, '-')}-${uuidv4().substring(0, 8)}`;

            const childNode: Node = {
              id: childId,
              content: genNode.new_node_content,
              edge: [],
            };

            const edge: Edge = {
              target_id: childId,
              relationship: genNode.relationship,
              rationale: genNode.rationale,
            };

            parentNode.edge.push(edge);
            nodes.push(childNode);
            nodeMap[childId] = childNode;
            nextQueue.push(childId);
            totalGenerated++;
          }
        } catch (error) {
          console.error(`[Step 2] Error generating children for ${parentId}:`, error);
        }
      }

      queue = nextQueue;
    }

    console.log(`[Step 2] Generated ${totalGenerated} new nodes across ${generations_count_int} generations`);

    return {
      nodes,
      nodeMap,
      totalGenerated,
    };
  },
});

// Step 3: Connect to Product Feature
const connectToProduct = createStep({
  id: 'connect-to-product',
  description: 'Create connections from leaf nodes to Product Feature anchor',
  inputSchema: z.object({
    nodes: z.array(z.any()),
    nodeMap: z.record(z.any()),
    totalGenerated: z.number(),
  }),
  outputSchema: z.object({
    nodes: z.array(z.any()),
    finalNodeCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    console.log('[Step 3] Connecting to Product Feature anchor...');

    const { nodes, nodeMap } = inputData;

    // Find leaf nodes (nodes with no outgoing edges, excluding Product Feature itself)
    const leafNodes = nodes.filter(
      (node: Node) =>
        node.id !== PRODUCT_FEATURE_ID &&
        node.id !== CUSTOMER_JOB_ID &&
        node.edge.length === 0
    );

    console.log(`[Step 3] Found ${leafNodes.length} leaf nodes to connect`);

    // Connect each leaf to Product Feature
    for (const leafNode of leafNodes) {
      const edge: Edge = {
        target_id: PRODUCT_FEATURE_ID,
        relationship: 'addressed by',
        rationale: `This need/challenge is addressed by the product's capabilities`,
      };

      leafNode.edge.push(edge);
    }

    console.log(`[Step 3] Connected ${leafNodes.length} leaf nodes to Product Feature`);

    return {
      nodes,
      finalNodeCount: nodes.length,
    };
  },
});

// Step 4: Finalize and add metadata
const finalizeGraph = createStep({
  id: 'finalize-graph',
  description: 'Add metadata and prepare final output',
  inputSchema: z.object({
    nodes: z.array(z.any()),
    finalNodeCount: z.number(),
  }),
  outputSchema: dreamOutputSchema,
  execute: async ({ inputData }) => {
    console.log('[Step 4] Finalizing knowledge graph...');

    const { nodes } = inputData;

    // Note: Generation time will be calculated by the server
    const generationTime = 0;

    const metadata = {
      totalNodes: nodes.length,
      generationTime,
      generations: 3, // This should come from input but hardcoded for now
    };

    console.log(`[Step 4] Knowledge graph complete: ${metadata.totalNodes} nodes in ${metadata.generationTime}ms`);

    return {
      nodes,
      metadata,
    };
  },
});

// Create the workflow by chaining steps
export const dreamWorkflow = createWorkflow({
  id: 'dream-workflow',
  inputSchema: dreamInputSchema,
  outputSchema: dreamOutputSchema,
})
  .then(initializeAnchors)
  .then(expandGraph)
  .then(connectToProduct)
  .then(finalizeGraph);

// Commit the workflow
dreamWorkflow.commit();

// Export types
export type DreamWorkflowInput = z.infer<typeof dreamInputSchema>;
export type DreamWorkflowOutput = z.infer<typeof dreamOutputSchema>;

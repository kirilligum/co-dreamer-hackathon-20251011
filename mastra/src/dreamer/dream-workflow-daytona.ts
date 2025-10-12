import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { LLMService } from './llm-service';
import { DaytonaService } from './daytona-service';
import { Node, Edge, CUSTOMER_JOB_ID, PRODUCT_FEATURE_ID } from './types';
import { v4 as uuidv4 } from 'uuid';

// Input schema for the workflow
const dreamInputSchema = z.object({
  customer: z.string().describe('Description of the customer/company to analyze'),
  product: z.string().describe('Description of the product to explore towards'),
  children_count: z.number().default(2).describe('Number of child nodes per parent'),
  generations_count_int: z.number().default(3).describe('Number of expansion levels'),
  dreamId: z.string().optional().describe('Unique identifier for this dream session'),
});

// Output schema
const dreamOutputSchema = z.object({
  nodes: z.array(z.any()),
  metadata: z.object({
    totalNodes: z.number(),
    generationTime: z.number(),
    generations: z.number(),
    daytonaWorkspaceId: z.string().optional(),
  }),
});

// Step 1: Create Daytona workspace
const createDaytonaWorkspace = createStep({
  id: 'create-daytona-workspace',
  description: 'Create a Daytona workspace for isolated dream execution',
  inputSchema: dreamInputSchema,
  outputSchema: z.object({
    customer: z.string(),
    product: z.string(),
    children_count: z.number(),
    generations_count_int: z.number(),
    dreamId: z.string(),
    daytonaService: z.any(),
    workspaceId: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log('[Step 1] Creating Daytona workspace...');

    const dreamId = inputData.dreamId || uuidv4();
    const daytonaService = new DaytonaService();

    try {
      const workspace = await daytonaService.createWorkspace(dreamId);

      console.log(`[Step 1] Daytona workspace created: ${workspace.id}`);

      // Install any necessary dependencies in the workspace
      console.log('[Step 1] Setting up workspace environment...');

      // You can install Python packages, Node modules, etc.
      // For example:
      // await daytonaService.executeCommand(dreamId, 'pip install requests');

      console.log('[Step 1] Workspace ready for dream execution');

      return {
        customer: inputData.customer,
        product: inputData.product,
        children_count: inputData.children_count,
        generations_count_int: inputData.generations_count_int,
        dreamId,
        daytonaService,
        workspaceId: workspace.id,
      };
    } catch (error) {
      console.error('[Step 1] Failed to create Daytona workspace:', error);
      throw error;
    }
  },
});

// Step 2: Initialize anchor nodes
const initializeAnchors = createStep({
  id: 'initialize-anchors',
  description: 'Create Customer Job and Product Feature anchor nodes',
  inputSchema: z.object({
    customer: z.string(),
    product: z.string(),
    children_count: z.number(),
    generations_count_int: z.number(),
    dreamId: z.string(),
    daytonaService: z.any(),
    workspaceId: z.string(),
  }),
  outputSchema: z.object({
    customer: z.string(),
    product: z.string(),
    children_count: z.number(),
    generations_count_int: z.number(),
    dreamId: z.string(),
    daytonaService: z.any(),
    workspaceId: z.string(),
    nodes: z.array(z.any()),
    nodeMap: z.record(z.any()),
  }),
  execute: async ({ inputData }) => {
    console.log('[Step 2] Initializing anchor nodes in Daytona workspace...');

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

    // Store initial graph state in the Daytona workspace
    try {
      const graphJson = JSON.stringify({ nodes, nodeMap }, null, 2);
      await inputData.daytonaService.writeFile(
        inputData.dreamId,
        '/workspace/graph-state.json',
        graphJson
      );
      console.log(`[Step 2] Graph state saved to Daytona workspace`);
    } catch (error) {
      console.warn('[Step 2] Could not save graph state to workspace:', error);
      // Continue even if file write fails
    }

    console.log(`[Step 2] Created anchor nodes: "${CUSTOMER_JOB_ID}" and "${PRODUCT_FEATURE_ID}"`);

    return {
      ...inputData,
      nodes,
      nodeMap,
    };
  },
});

// Step 3: BFS Expansion (multiple generations) in Daytona
const expandGraphInDaytona = createStep({
  id: 'expand-graph-daytona',
  description: 'Expand knowledge graph using BFS algorithm in Daytona workspace',
  inputSchema: z.object({
    customer: z.string(),
    product: z.string(),
    children_count: z.number(),
    generations_count_int: z.number(),
    dreamId: z.string(),
    daytonaService: z.any(),
    workspaceId: z.string(),
    nodes: z.array(z.any()),
    nodeMap: z.record(z.any()),
  }),
  outputSchema: z.object({
    dreamId: z.string(),
    daytonaService: z.any(),
    workspaceId: z.string(),
    nodes: z.array(z.any()),
    nodeMap: z.record(z.any()),
    totalGenerated: z.number(),
  }),
  execute: async ({ inputData }) => {
    console.log('[Step 3] Expanding graph with BFS in Daytona workspace...');

    const llmService = new LLMService();
    const { customer, product, children_count, generations_count_int, nodes, nodeMap, daytonaService, dreamId } = inputData;

    let queue = [CUSTOMER_JOB_ID];
    let totalGenerated = 0;

    for (let generation = 0; generation < generations_count_int; generation++) {
      console.log(`[Step 3] Generation ${generation + 1}/${generations_count_int} - Processing ${queue.length} nodes`);

      const nextQueue: string[] = [];

      for (const parentId of queue) {
        const parentNode = nodeMap[parentId];

        try {
          // Generate nodes using LLM (this happens outside Daytona but can be logged there)
          const generatedNodes = await llmService.generateNodes(
            customer,
            product,
            parentNode.content,
            children_count
          );

          // Log the generation to Daytona workspace
          const logEntry = `Generation ${generation + 1}: Parent "${parentId}" -> ${generatedNodes.length} children\n`;
          try {
            await daytonaService.executeCommand(
              dreamId,
              `echo '${logEntry.replace(/'/g, "'\\''")}' >> /workspace/generation.log`
            );
          } catch (error) {
            console.warn('[Step 3] Could not write to generation log:', error);
          }

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
          console.error(`[Step 3] Error generating children for ${parentId}:`, error);
          // Log error to Daytona workspace
          try {
            await daytonaService.executeCommand(
              dreamId,
              `echo 'ERROR for ${parentId}: ${String(error)}' >> /workspace/errors.log`
            );
          } catch (logError) {
            console.warn('[Step 3] Could not log error to workspace:', logError);
          }
        }
      }

      queue = nextQueue;

      // Save checkpoint after each generation
      try {
        const checkpointJson = JSON.stringify({ generation, nodes, nodeMap, totalGenerated }, null, 2);
        await daytonaService.writeFile(
          dreamId,
          `/workspace/checkpoint-gen${generation + 1}.json`,
          checkpointJson
        );
        console.log(`[Step 3] Checkpoint saved for generation ${generation + 1}`);
      } catch (error) {
        console.warn('[Step 3] Could not save checkpoint:', error);
      }
    }

    console.log(`[Step 3] Generated ${totalGenerated} new nodes across ${generations_count_int} generations`);

    // Save final graph state
    try {
      const finalGraphJson = JSON.stringify({ nodes, nodeMap, totalGenerated }, null, 2);
      await daytonaService.writeFile(
        dreamId,
        '/workspace/final-graph.json',
        finalGraphJson
      );
      console.log('[Step 3] Final graph saved to Daytona workspace');
    } catch (error) {
      console.warn('[Step 3] Could not save final graph:', error);
    }

    return {
      dreamId,
      daytonaService,
      workspaceId: inputData.workspaceId,
      nodes,
      nodeMap,
      totalGenerated,
    };
  },
});

// Step 4: Connect to Product Feature
const connectToProduct = createStep({
  id: 'connect-to-product',
  description: 'Create connections from leaf nodes to Product Feature anchor',
  inputSchema: z.object({
    dreamId: z.string(),
    daytonaService: z.any(),
    workspaceId: z.string(),
    nodes: z.array(z.any()),
    nodeMap: z.record(z.any()),
    totalGenerated: z.number(),
  }),
  outputSchema: z.object({
    dreamId: z.string(),
    daytonaService: z.any(),
    workspaceId: z.string(),
    nodes: z.array(z.any()),
    finalNodeCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    console.log('[Step 4] Connecting to Product Feature anchor in Daytona workspace...');

    const { nodes, nodeMap, daytonaService, dreamId } = inputData;

    // Find leaf nodes (nodes with no outgoing edges, excluding Product Feature itself)
    const leafNodes = nodes.filter(
      (node: Node) =>
        node.id !== PRODUCT_FEATURE_ID &&
        node.id !== CUSTOMER_JOB_ID &&
        node.edge.length === 0
    );

    console.log(`[Step 4] Found ${leafNodes.length} leaf nodes to connect`);

    // Connect each leaf to Product Feature
    for (const leafNode of leafNodes) {
      const edge: Edge = {
        target_id: PRODUCT_FEATURE_ID,
        relationship: 'addressed by',
        rationale: `This need/challenge is addressed by the product's capabilities`,
      };

      leafNode.edge.push(edge);
    }

    console.log(`[Step 4] Connected ${leafNodes.length} leaf nodes to Product Feature`);

    // Log connections to Daytona workspace
    try {
      await daytonaService.executeCommand(
        dreamId,
        `echo 'Connected ${leafNodes.length} leaf nodes to Product Feature' >> /workspace/connections.log`
      );
    } catch (error) {
      console.warn('[Step 4] Could not write connections log:', error);
    }

    return {
      dreamId,
      daytonaService,
      workspaceId: inputData.workspaceId,
      nodes,
      finalNodeCount: nodes.length,
    };
  },
});

// Step 5: Finalize and cleanup
const finalizeAndCleanup = createStep({
  id: 'finalize-cleanup',
  description: 'Add metadata, save results, and cleanup Daytona workspace',
  inputSchema: z.object({
    dreamId: z.string(),
    daytonaService: z.any(),
    workspaceId: z.string(),
    nodes: z.array(z.any()),
    finalNodeCount: z.number(),
  }),
  outputSchema: dreamOutputSchema,
  execute: async ({ inputData }) => {
    console.log('[Step 5] Finalizing knowledge graph and cleaning up...');

    const { nodes, daytonaService, dreamId, workspaceId } = inputData;

    // Note: Generation time will be calculated by the server
    const generationTime = 0;

    const metadata = {
      totalNodes: nodes.length,
      generationTime,
      generations: 3, // This should come from input but hardcoded for now
      daytonaWorkspaceId: workspaceId,
    };

    console.log(`[Step 5] Knowledge graph complete: ${metadata.totalNodes} nodes in ${metadata.generationTime}ms`);
    console.log(`[Step 5] Daytona workspace: ${workspaceId}`);

    // Save final results to workspace
    try {
      const resultsJson = JSON.stringify({ nodes, metadata }, null, 2);
      await daytonaService.writeFile(
        dreamId,
        '/workspace/results.json',
        resultsJson
      );
      console.log('[Step 5] Results saved to Daytona workspace');
    } catch (error) {
      console.warn('[Step 5] Could not save results to workspace:', error);
    }

    // Cleanup workspace (optional - keep it for debugging or destroy it)
    const shouldKeepWorkspace = process.env.KEEP_DAYTONA_WORKSPACE === 'true';

    if (!shouldKeepWorkspace) {
      console.log('[Step 5] Destroying Daytona workspace...');
      try {
        await daytonaService.destroyWorkspace(dreamId);
        console.log('[Step 5] Workspace destroyed successfully');
      } catch (error) {
        console.error('[Step 5] Error destroying workspace:', error);
        // Don't throw - we want to return results even if cleanup fails
      }
    } else {
      console.log('[Step 5] Keeping Daytona workspace for debugging');
    }

    return {
      nodes,
      metadata,
    };
  },
});

// Create the workflow by chaining steps
export const dreamWorkflowDaytona = createWorkflow({
  id: 'dream-workflow-daytona',
  inputSchema: dreamInputSchema,
  outputSchema: dreamOutputSchema,
})
  .then(createDaytonaWorkspace)
  .then(initializeAnchors)
  .then(expandGraphInDaytona)
  .then(connectToProduct)
  .then(finalizeAndCleanup);

// Commit the workflow
dreamWorkflowDaytona.commit();

// Export types
export type DreamWorkflowInput = z.infer<typeof dreamInputSchema>;
export type DreamWorkflowOutput = z.infer<typeof dreamOutputSchema>;

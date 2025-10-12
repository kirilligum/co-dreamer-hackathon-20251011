import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { DreamerService } from "./dreamer-service";
import { DreamRequest } from "./types";
import { mastra } from "./mastra-instance";
import { GraphStorageService } from "./graph-storage";
import { RAGService } from "./rag-service";
import { GraphEvalService } from "./eval-service";

// Load environment variables from .env file in project root
config({ path: "/home/kirill/hachathons/co-dreamer-hackathon-20251011/.env" });

const app = new Hono();

// Enable CORS for frontend
app.use("/*", cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
  credentials: true,
}));

const dreamerService = new DreamerService();
const graphStorage = new GraphStorageService();
const ragService = new RAGService();
const evalService = new GraphEvalService();

// Flag to toggle between workflow and legacy implementation
const USE_WORKFLOW = process.env.USE_WORKFLOW === 'true';

// Initialize storage asynchronously
(async () => {
  try {
    await graphStorage.initialize();
    console.log('[GraphStorage] Initialization complete');
  } catch (error) {
    console.error('[GraphStorage] Initialization failed:', error);
    process.exit(1);
  }
})();

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "Knowledge Dreamer Microservice",
    version: "1.0.0"
  });
});

// Main dreaming endpoint
app.post("/api/v1/dream", async (c) => {
  try {
    const body = await c.req.json<DreamRequest>();

    // Validate required fields
    if (!body.customer) {
      return c.json({ error: "Missing required field: customer" }, 400);
    }
    if (!body.product) {
      return c.json({ error: "Missing required field: product" }, 400);
    }

    console.log("Starting dream process...");
    console.log(`Implementation: ${USE_WORKFLOW ? 'Mastra Workflow' : 'Legacy BFS'}`);
    console.log(`Customer: ${body.customer.substring(0, 50)}...`);
    console.log(`Product: ${body.product.substring(0, 50)}...`);
    console.log(`Children count: ${body.children_count || 2}`);
    console.log(`Generations: ${body.generations_count_int || 3}`);

    const startTime = Date.now();
    let graph;

    if (USE_WORKFLOW) {
      // Use Mastra workflow
      console.log("Using Mastra workflow implementation");

      const workflow = mastra.getWorkflow('dreamWorkflow');
      const run = await workflow.createRunAsync();
      const workflowResult = await run.start({
        inputData: {
          customer: body.customer,
          product: body.product,
          children_count: body.children_count || 2,
          generations_count_int: body.generations_count_int || 3,
        },
        context: {
          workflowStartTime: startTime,
        },
      });

      if (workflowResult.status === 'success') {
        graph = workflowResult.result.nodes;
        console.log(`Workflow completed in ${workflowResult.result.metadata.generationTime}ms`);
        console.log(`Generated ${workflowResult.result.metadata.totalNodes} nodes`);
      } else {
        throw new Error(`Workflow failed with status: ${workflowResult.status}`);
      }
    } else {
      // Use legacy implementation
      console.log("Using legacy BFS implementation");
      graph = await dreamerService.dream(body);
      const duration = Date.now() - startTime;
      console.log(`Dream completed in ${duration}ms`);
      console.log(`Generated ${graph.length} nodes`);
    }

    // Save graph to database
    const generationTime = Date.now() - startTime;
    let graphId: string | undefined;
    try {
      const storedGraph = await graphStorage.saveGraph({
        customer: body.customer,
        product: body.product,
        nodes: graph,
        generationTimeMs: generationTime,
        metadata: {
          childrenCount: body.children_count || 2,
          generationsCount: body.generations_count_int || 3,
          implementation: USE_WORKFLOW ? 'workflow' : 'legacy'
        }
      });
      graphId = storedGraph.id;
      console.log(`[Storage] Graph saved with ID: ${storedGraph.id}`);
    } catch (storageError) {
      console.error('[Storage] Failed to save graph, continuing with response:', storageError);
      // Continue even if storage fails - don't break the API
    }

    // Index graph for semantic search
    if (graphId) {
      try {
        await ragService.indexGraph({
          graphId,
          customer: body.customer,
          product: body.product,
          nodes: graph,
        });
        console.log(`[RAG] Successfully indexed graph ${graphId}`);
      } catch (ragError) {
        console.error('[RAG] Failed to index graph, continuing with response:', ragError);
        // Continue even if indexing fails - don't break the API
      }
    }

    return c.json(graph);
  } catch (error) {
    console.error("Error in dream endpoint:", error);
    return c.json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// List all graphs with optional filters
app.get("/api/v1/graphs", async (c) => {
  try {
    const customer = c.req.query('customer');
    const product = c.req.query('product');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');

    const graphs = await graphStorage.listGraphs({
      customer,
      product,
      limit,
      offset
    });
    const total = await graphStorage.countGraphs({ customer, product });

    return c.json({
      graphs,
      total,
      limit,
      offset,
      hasMore: offset + graphs.length < total
    });
  } catch (error) {
    console.error("Error in list graphs endpoint:", error);
    return c.json({
      error: "Failed to retrieve graphs",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Get a specific graph by ID
app.get("/api/v1/graphs/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const graph = await graphStorage.getGraph(id);

    if (!graph) {
      return c.json({ error: "Graph not found" }, 404);
    }

    return c.json(graph);
  } catch (error) {
    console.error("Error in get graph endpoint:", error);
    return c.json({
      error: "Failed to retrieve graph",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Search graphs by customer and/or product
app.get("/api/v1/graphs/search", async (c) => {
  try {
    const customer = c.req.query('customer');
    const product = c.req.query('product');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');

    if (!customer && !product) {
      return c.json({
        error: "At least one search parameter (customer or product) is required"
      }, 400);
    }

    const graphs = await graphStorage.listGraphs({
      customer,
      product,
      limit,
      offset
    });
    const total = await graphStorage.countGraphs({ customer, product });

    return c.json({
      query: { customer, product },
      results: graphs,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error("Error in search graphs endpoint:", error);
    return c.json({
      error: "Failed to search graphs",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Get database statistics
app.get("/api/v1/stats", async (c) => {
  try {
    const stats = await graphStorage.getStats();
    return c.json(stats);
  } catch (error) {
    console.error("Error in stats endpoint:", error);
    return c.json({
      error: "Failed to retrieve statistics",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Delete a graph by ID
app.delete("/api/v1/graphs/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await graphStorage.deleteGraph(id);

    if (!deleted) {
      return c.json({ error: "Graph not found or already deleted" }, 404);
    }

    // Also remove from RAG index
    try {
      await ragService.removeGraph(id);
    } catch (ragError) {
      console.error('[RAG] Failed to remove graph from index:', ragError);
    }

    return c.json({
      success: true,
      message: `Graph ${id} deleted successfully`
    });
  } catch (error) {
    console.error("Error in delete graph endpoint:", error);
    return c.json({
      error: "Failed to delete graph",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Semantic search for nodes
app.get("/api/v1/search/nodes", async (c) => {
  try {
    const query = c.req.query('q');
    const limit = parseInt(c.req.query('limit') || '10');
    const customer = c.req.query('customer');
    const product = c.req.query('product');
    const minScore = parseFloat(c.req.query('minScore') || '0.5');

    if (!query) {
      return c.json({
        error: "Missing required parameter: q (query)"
      }, 400);
    }

    const results = await ragService.searchNodes({
      query,
      limit,
      customer,
      product,
      minScore,
    });

    return c.json({
      query,
      results,
      count: results.length,
      filters: {
        customer: customer || null,
        product: product || null,
        minScore,
      }
    });
  } catch (error) {
    console.error("Error in semantic search endpoint:", error);
    return c.json({
      error: "Failed to search nodes",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Get RAG statistics
app.get("/api/v1/search/stats", async (c) => {
  try {
    const stats = ragService.getStats();

    return c.json({
      totalNodes: stats.totalNodes,
      totalGraphs: stats.totalGraphs,
      graphBreakdown: Array.from(stats.graphBreakdown.entries()).map(([graphId, count]) => ({
        graphId,
        nodeCount: count,
      })),
    });
  } catch (error) {
    console.error("Error in RAG stats endpoint:", error);
    return c.json({
      error: "Failed to retrieve RAG statistics",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Evaluate a specific graph by ID
app.post("/api/v1/eval/graph/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const graph = await graphStorage.getGraph(id);

    if (!graph) {
      return c.json({ error: "Graph not found" }, 404);
    }

    const evalResult = await evalService.evaluateGraph({
      nodes: graph.nodes,
      customer: graph.customer,
      product: graph.product,
      metadata: graph.metadata,
    });

    return c.json({
      graphId: id,
      evaluation: evalResult,
      graphMetadata: {
        customer: graph.customer,
        product: graph.product,
        createdAt: graph.createdAt,
        implementation: graph.metadata?.implementation,
      },
    });
  } catch (error) {
    console.error("Error in eval graph endpoint:", error);
    return c.json({
      error: "Failed to evaluate graph",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Compare two graphs
app.post("/api/v1/eval/compare", async (c) => {
  try {
    const body = await c.req.json<{
      graphId1: string;
      graphId2: string;
      label1?: string;
      label2?: string;
    }>();

    if (!body.graphId1 || !body.graphId2) {
      return c.json({
        error: "Missing required fields: graphId1 and graphId2"
      }, 400);
    }

    const [graph1, graph2] = await Promise.all([
      graphStorage.getGraph(body.graphId1),
      graphStorage.getGraph(body.graphId2),
    ]);

    if (!graph1) {
      return c.json({ error: `Graph ${body.graphId1} not found` }, 404);
    }
    if (!graph2) {
      return c.json({ error: `Graph ${body.graphId2} not found` }, 404);
    }

    const comparison = await evalService.compareGraphs({
      graph1: {
        nodes: graph1.nodes,
        customer: graph1.customer,
        product: graph1.product,
        metadata: graph1.metadata,
        label: body.label1 || `Graph ${body.graphId1.substring(0, 8)}`,
      },
      graph2: {
        nodes: graph2.nodes,
        customer: graph2.customer,
        product: graph2.product,
        metadata: graph2.metadata,
        label: body.label2 || `Graph ${body.graphId2.substring(0, 8)}`,
      },
    });

    return c.json(comparison);
  } catch (error) {
    console.error("Error in compare graphs endpoint:", error);
    return c.json({
      error: "Failed to compare graphs",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Start the server
const port = 3457;

console.log(`Starting Knowledge Dreamer Microservice on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server is running at http://localhost:${port}`);

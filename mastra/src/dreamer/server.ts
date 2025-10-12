import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { DreamerService } from "./dreamer-service";
import { DreamRequest } from "./types";
import { mastra } from "./mastra-instance";

// Load environment variables from .env file
config({ path: ".env" });

const app = new Hono();

// Enable CORS for frontend
app.use("/*", cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
  credentials: true,
}));

const dreamerService = new DreamerService();

// Flag to toggle between workflow and legacy implementation
const USE_WORKFLOW = process.env.USE_WORKFLOW === 'true';

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

    return c.json(graph);
  } catch (error) {
    console.error("Error in dream endpoint:", error);
    return c.json({
      error: "Internal server error",
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

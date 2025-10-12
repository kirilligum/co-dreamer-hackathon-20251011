import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { DreamerService } from "./dreamer-service";
import { DreamRequest } from "./types";

// Load environment variables from .env file
config({ path: ".env" });

const app = new Hono();

// Enable CORS for frontend
app.use("/*", cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
  credentials: true,
}));

const dreamerService = new DreamerService();

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
    console.log(`Customer: ${body.customer.substring(0, 50)}...`);
    console.log(`Product: ${body.product.substring(0, 50)}...`);
    console.log(`Children count: ${body.children_count || 2}`);
    console.log(`Generations: ${body.generations_count_int || 3}`);

    // Execute the dreaming process
    const startTime = Date.now();
    const graph = await dreamerService.dream(body);
    const duration = Date.now() - startTime;

    console.log(`Dream completed in ${duration}ms`);
    console.log(`Generated ${graph.length} nodes`);

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

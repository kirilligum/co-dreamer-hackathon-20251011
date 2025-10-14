#!/bin/bash

# CoDreamer API Test Script
# Tests the complete flow from Dream API to CoDreamer API
# Based on the API_GUIDE.md examples

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DREAM_API_URL="http://localhost:3457"
CODREAMER_API_URL="http://localhost:8000"
OUTPUT_DIR="/tmp/codreamer-test"
TEST_KG_FILE="$OUTPUT_DIR/pearls-weave-kg.json"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CoDreamer API Test Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check which implementation is being used
if [ -n "$USE_WORKFLOW" ] && [ "$USE_WORKFLOW" = "true" ]; then
    echo -e "${GREEN}Using Mastra Workflow implementation${NC}"
else
    echo -e "${YELLOW}Using Legacy BFS implementation${NC}"
    echo -e "${YELLOW}To test workflows, run: USE_WORKFLOW=true ./test-codreamer-apis.sh${NC}"
fi
echo ""

# Step 1: Test Dream API Health
echo -e "${YELLOW}[Step 1/7]${NC} Testing Dream API health..."
if curl -s "$DREAM_API_URL/" | jq -e '.status == "ok"' > /dev/null; then
    echo -e "${GREEN}✓ Dream API is running${NC}"
    curl -s "$DREAM_API_URL/" | jq .
else
    echo -e "${RED}✗ Dream API is not running on $DREAM_API_URL${NC}"
    echo "Please start the Dream API with: cd mastra && npx tsx src/dreamer/server.ts"
    exit 1
fi
echo ""

# Step 2: Generate Knowledge Graph
echo -e "${YELLOW}[Step 2/7]${NC} Generating knowledge graph (Pearls of Wisdom → W&B Weave)..."
echo "This may take 10-20 seconds..."

HTTP_CODE=$(curl -s -o "$TEST_KG_FILE" -w "%{http_code}" \
  -X POST "$DREAM_API_URL/api/v1/dream" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets for training AI models.",
    "product": "Weights and Biases Weave, featuring a UI for feedback and model evaluation."
  }')

if [ "$HTTP_CODE" -eq 200 ]; then
    NODE_COUNT=$(cat "$TEST_KG_FILE" | jq 'length')
    echo -e "${GREEN}✓ Knowledge graph generated successfully${NC}"
    echo "  - HTTP Status: $HTTP_CODE"
    echo "  - Nodes: $NODE_COUNT"
    echo "  - Saved to: $TEST_KG_FILE"

    # Show first node (Customer Job)
    echo -e "\n  First node (Customer Job):"
    cat "$TEST_KG_FILE" | jq '.[0]' | head -10
else
    echo -e "${RED}✗ Failed to generate knowledge graph (HTTP $HTTP_CODE)${NC}"
    cat "$TEST_KG_FILE"
    exit 1
fi
echo ""

# Step 3: Visualize Knowledge Graph
echo -e "${YELLOW}[Step 3/7]${NC} Generating visualizations (PNG, SVG, Mermaid)..."

cd "$(dirname "$0")"

if npx tsx scripts/graph-to-png.ts "$TEST_KG_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Visualizations generated successfully${NC}"
    echo "  - PNG: ${TEST_KG_FILE%.json}.png"
    echo "  - SVG: ${TEST_KG_FILE%.json}.svg"
    echo "  - Mermaid: ${TEST_KG_FILE%.json}.mmd"
else
    echo -e "${YELLOW}⚠ Visualization generation failed (non-critical)${NC}"
    echo "  You can manually run: npx tsx scripts/graph-to-png.ts $TEST_KG_FILE"
fi
echo ""

# Step 4: Test CoDreamer API Health
echo -e "${YELLOW}[Step 4/7]${NC} Testing CoDreamer API health..."

if curl -s "$CODREAMER_API_URL/" | jq -e '.status == "ok"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ CoDreamer API is running${NC}"
    curl -s "$CODREAMER_API_URL/" | jq .
else
    echo -e "${YELLOW}⚠ CoDreamer API is not running on $CODREAMER_API_URL${NC}"
    echo "  Skipping CoDreamer tests."
    echo "  To run full tests, start CoDreamer API with:"
    echo "  python -m uvicorn codreamer.scripts.api:app --host 0.0.0.0 --port 8000"
    exit 0
fi
echo ""

# Step 5: Test CoDreamer with existing KG (quick test)
echo -e "${YELLOW}[Step 5/7]${NC} Testing CoDreamer API (using existing graph)..."
echo "Note: This runs the learn-loop with the default graph in codreamer/data/graph.json"

RESPONSE=$(curl -s -X POST "$CODREAMER_API_URL/learn-loop" \
  -H "Content-Type: application/json" \
  -d '{
    "iterations": 1,
    "depth": 3
  }')

if echo "$RESPONSE" | jq -e '.run_id' > /dev/null 2>&1; then
    RUN_ID=$(echo "$RESPONSE" | jq -r '.run_id')
    RESULTS_PATH=$(echo "$RESPONSE" | jq -r '.results_path')
    echo -e "${GREEN}✓ CoDreamer learn-loop started${NC}"
    echo "  - Run ID: $RUN_ID"
    echo "  - Results path: $RESULTS_PATH"
    echo "  - Status: Running in background"
else
    echo -e "${RED}✗ Failed to start CoDreamer learn-loop${NC}"
    echo "$RESPONSE" | jq .
    exit 1
fi
echo ""

# Step 6: Optional - Test with generated KG (slow, commented out by default)
echo -e "${YELLOW}[Step 6/7]${NC} Optionally test with generated KG..."
echo -e "${YELLOW}⚠ This step is SLOW (can take 5-10 minutes) and is disabled by default${NC}"
echo "  To enable, uncomment the curl command in the script"
echo ""

# Uncomment below to test with the generated Pearls of Wisdom graph
# echo "Starting learn-loop with Pearls of Wisdom → W&B Weave graph..."
# RESPONSE2=$(curl -s -X POST "$CODREAMER_API_URL/learn-loop" \
#   -H "Content-Type: application/json" \
#   -d "{
#     \"graph\": $(cat "$TEST_KG_FILE"),
#     \"iterations\": 2,
#     \"depth\": 4
#   }")
#
# if echo "$RESPONSE2" | jq -e '.run_id' > /dev/null 2>&1; then
#     RUN_ID2=$(echo "$RESPONSE2" | jq -r '.run_id')
#     echo -e "${GREEN}✓ Learn-loop started with custom graph${NC}"
#     echo "  - Run ID: $RUN_ID2"
# fi

# Step 7: Summary
echo -e "${YELLOW}[Step 7/7]${NC} Test Summary"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All tests passed!${NC}"
echo ""
echo "Generated files:"
echo "  - Knowledge Graph: $TEST_KG_FILE"
echo "  - Visualizations: ${TEST_KG_FILE%.json}.{png,svg,mmd}"
if [ -n "$RUN_ID" ]; then
    echo "  - CoDreamer Results: codreamer/results/runs/$RUN_ID/"
fi
echo ""
echo "Next steps:"
echo "  1. View the knowledge graph visualization:"
echo "     open ${TEST_KG_FILE%.json}.png"
echo ""
if [ -n "$RUN_ID" ]; then
    echo "  2. Monitor CoDreamer progress:"
    echo "     watch -n 5 'ls -lh codreamer/results/runs/$RUN_ID/'"
    echo ""
    echo "  3. View final email when complete:"
    echo "     cat codreamer/results/runs/$RUN_ID/final_email.json | jq ."
    echo ""
fi
echo "  4. View API documentation:"
echo "     - Dream API: http://localhost:3457"
echo "     - CoDreamer API: http://localhost:8000/docs"
echo ""
echo -e "${BLUE}========================================${NC}"

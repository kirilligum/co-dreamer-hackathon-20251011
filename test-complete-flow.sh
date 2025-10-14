#!/bin/bash

# Complete Flow Test Script
# Tests Dream API → CoDreamer API with file persistence
# Usage: ./test-complete-flow.sh
#        USE_WORKFLOW=true ./test-complete-flow.sh

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DREAM_API_URL="http://localhost:3457"
CODREAMER_API_URL="http://localhost:8000"
OUTPUT_DIR="./test-outputs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Output files
KG_FILE="$OUTPUT_DIR/knowledge-graph-$TIMESTAMP.json"
PIPELINE_RESPONSE="$OUTPUT_DIR/pipeline-response-$TIMESTAMP.json"
FINAL_EMAIL="$OUTPUT_DIR/final-email-$TIMESTAMP.json"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Print header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Complete Flow Test: Dream → CoDreamer${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Show implementation being used
if [ -n "$USE_WORKFLOW" ] && [ "$USE_WORKFLOW" = "true" ]; then
    echo -e "${GREEN}✓ Using Mastra Workflow implementation${NC}"
else
    echo -e "${YELLOW}⚠ Using Legacy BFS implementation${NC}"
    echo -e "${CYAN}  Tip: Run with USE_WORKFLOW=true for better observability${NC}"
fi
echo ""

# Step 1: Check Dream API
echo -e "${YELLOW}[Step 1/6]${NC} Checking Dream API health..."
if curl -s "$DREAM_API_URL/" | jq -e '.status == "ok"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Dream API is running${NC}"
else
    echo -e "${RED}✗ Dream API is not running on $DREAM_API_URL${NC}"
    echo "Please start it with: cd mastra && USE_WORKFLOW=true npx tsx src/dreamer/server.ts"
    exit 1
fi
echo ""

# Step 2: Check CoDreamer API
echo -e "${YELLOW}[Step 2/6]${NC} Checking CoDreamer API health..."
if curl -s "$CODREAMER_API_URL/" | jq -e '.status == "ok"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ CoDreamer API is running${NC}"
else
    echo -e "${RED}✗ CoDreamer API is not running on $CODREAMER_API_URL${NC}"
    echo "Please start it with: python -m uvicorn codreamer.scripts.api:app --host 0.0.0.0 --port 8000"
    exit 1
fi
echo ""

# Step 3: Generate Knowledge Graph
echo -e "${YELLOW}[Step 3/6]${NC} Generating knowledge graph..."
echo -e "${CYAN}  Customer: Pearls of Wisdom (synthetic data company)${NC}"
echo -e "${CYAN}  Product: Weights & Biases Weave (feedback & evaluation UI)${NC}"
echo -e "${CYAN}  This may take 10-15 seconds...${NC}\n"

HTTP_CODE=$(curl -s -o "$KG_FILE" -w "%{http_code}" \
  -X POST "$DREAM_API_URL/api/v1/dream" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Pearls of Wisdom, a company that generates synthetic data sets for training AI models.",
    "product": "Weights and Biases Weave, featuring a UI for feedback and model evaluation.",
    "children_count": 2,
    "generations_count_int": 3
  }')

if [ "$HTTP_CODE" -eq 200 ]; then
    NODE_COUNT=$(cat "$KG_FILE" | jq 'length')
    echo -e "${GREEN}✓ Knowledge graph generated successfully${NC}"
    echo -e "  ${CYAN}HTTP Status:${NC} $HTTP_CODE"
    echo -e "  ${CYAN}Total Nodes:${NC} $NODE_COUNT"
    echo -e "  ${CYAN}Saved to:${NC} $KG_FILE"

    # Show anchor nodes
    CUSTOMER_NODE=$(cat "$KG_FILE" | jq -r '.[] | select(.id == "Customer Job") | .content' | head -c 80)
    PRODUCT_NODE=$(cat "$KG_FILE" | jq -r '.[] | select(.id == "Product Feature") | .content' | head -c 80)
    echo -e "\n  ${CYAN}Anchor Nodes:${NC}"
    echo -e "    ${BLUE}•${NC} Customer Job: $CUSTOMER_NODE..."
    echo -e "    ${BLUE}•${NC} Product Feature: $PRODUCT_NODE..."
else
    echo -e "${RED}✗ Failed to generate knowledge graph (HTTP $HTTP_CODE)${NC}"
    cat "$KG_FILE"
    exit 1
fi
echo ""

# Step 4: Run CoDreamer Pipeline
echo -e "${YELLOW}[Step 4/6]${NC} Running CoDreamer learning pipeline..."
echo -e "${CYAN}  Iterations: 2${NC}"
echo -e "${CYAN}  Depth: 3${NC}"
echo -e "${CYAN}  This will take 2-5 minutes...${NC}\n"

# Use the generated knowledge graph
RESPONSE=$(curl -s -X POST "$CODREAMER_API_URL/learn-loop" \
  -H "Content-Type: application/json" \
  -d "{
    \"graph\": $(cat "$KG_FILE"),
    \"iterations\": 2,
    \"depth\": 3
  }")

# Save pipeline response
echo "$RESPONSE" > "$PIPELINE_RESPONSE"

if echo "$RESPONSE" | jq -e '.run_id' > /dev/null 2>&1; then
    RUN_ID=$(echo "$RESPONSE" | jq -r '.run_id')
    RESULTS_PATH=$(echo "$RESPONSE" | jq -r '.results_path')
    echo -e "${GREEN}✓ CoDreamer pipeline started${NC}"
    echo -e "  ${CYAN}Run ID:${NC} $RUN_ID"
    echo -e "  ${CYAN}Results Path:${NC} $RESULTS_PATH"
    echo -e "  ${CYAN}Response saved to:${NC} $PIPELINE_RESPONSE"
else
    echo -e "${RED}✗ Failed to start CoDreamer pipeline${NC}"
    echo "$RESPONSE" | jq .
    exit 1
fi
echo ""

# Step 5: Wait for pipeline to complete
echo -e "${YELLOW}[Step 5/6]${NC} Waiting for pipeline to complete..."
echo -e "${CYAN}  Monitoring: $RESULTS_PATH/final_email.json${NC}\n"

MAX_WAIT=600  # 10 minutes
WAIT_TIME=0
SLEEP_INTERVAL=5

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if [ -f "$RESULTS_PATH/final_email.json" ]; then
        echo -e "${GREEN}✓ Pipeline completed!${NC}"
        break
    fi

    echo -e "${CYAN}  Waiting... ${WAIT_TIME}s elapsed${NC}"
    sleep $SLEEP_INTERVAL
    WAIT_TIME=$((WAIT_TIME + SLEEP_INTERVAL))
done

if [ ! -f "$RESULTS_PATH/final_email.json" ]; then
    echo -e "${RED}✗ Pipeline did not complete within ${MAX_WAIT}s${NC}"
    echo "Check the CoDreamer API logs for errors"
    exit 1
fi
echo ""

# Step 6: Extract and save final email
echo -e "${YELLOW}[Step 6/6]${NC} Extracting final email..."

cp "$RESULTS_PATH/final_email.json" "$FINAL_EMAIL"

if [ -f "$FINAL_EMAIL" ]; then
    echo -e "${GREEN}✓ Final email saved${NC}"
    echo -e "  ${CYAN}Saved to:${NC} $FINAL_EMAIL\n"

    # Display the email
    SUBJECT=$(cat "$FINAL_EMAIL" | jq -r '.subject')
    BODY=$(cat "$FINAL_EMAIL" | jq -r '.body')
    CITATIONS=$(cat "$FINAL_EMAIL" | jq -r '.citations | length')

    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}Final Email Preview:${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

    echo -e "${CYAN}Subject:${NC}"
    echo -e "  $SUBJECT\n"

    echo -e "${CYAN}Body:${NC}"
    echo "$BODY" | fold -s -w 70 | sed 's/^/  /'
    echo ""

    echo -e "${CYAN}Citations:${NC} $CITATIONS nodes from knowledge graph"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
else
    echo -e "${RED}✗ Failed to extract final email${NC}"
    exit 1
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Complete Flow Test Passed!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${CYAN}Generated Files:${NC}"
echo -e "  1. Knowledge Graph:   $KG_FILE"
echo -e "  2. Pipeline Response: $PIPELINE_RESPONSE"
echo -e "  3. Final Email:       $FINAL_EMAIL\n"

echo -e "${CYAN}Results Directory:${NC}"
echo -e "  $RESULTS_PATH\n"

echo -e "${CYAN}Additional Results:${NC}"
echo -e "  • Node scores: $RESULTS_PATH/iter*_node_scores.json"
echo -e "  • Iteration emails: $RESULTS_PATH/iter*_email.json"
echo -e "  • Reward metrics: $RESULTS_PATH/iter*_rewards_metrics.json\n"

echo -e "${CYAN}View files with:${NC}"
echo -e "  cat $FINAL_EMAIL | jq ."
echo -e "  cat $KG_FILE | jq ."
echo -e "  ls -lh $RESULTS_PATH\n"

echo -e "${GREEN}Test completed successfully! 🎉${NC}"

### RL reformulation (ART \+ RULER)

- **Objective**: Maximize downstream conversion (reply/meeting/closed-won) by generating personalized sales emails grounded in a customer-product knowledge graph (KG).  
    
- **Environment (state/observations)**:  
    
  - **State**: Prospect profile, account context, product fit, prior interactions; current KG subgraph around the prospect/product.  
  - **Observations**: Tool outputs (KG node facts, path summaries, assets), running email draft, compliance/brand checks.


- **Actions (tool-using policy)**:  
    
  - `get_connected_nodes(node_id)` → return a small, ranked set of neighbor node_ids.  
  - `get_relevant_context(node_id)` → return a concise text block synthesized from the node and top-scored neighbors, plus `citations`.  
  - `finalize_email(subject, body, citations)` → returns the final email with cited KG node_ids.


- **Episodes (rollouts)**:  
    
  - Up to N turns: browse KG via `get_connected_nodes`, pull evidence via `get_relevant_context`, draft subject/body, then call `finalize_email`.  
  - Terminal action is `finalize_email`. Trajectory records tool calls, drafts, and citations.

Graph requirements
- The KG must always include two anchor nodes: `Customer Job` (seed for exploration) and `Product Feature` (target endpoint for evidence paths).  
- `get_relevant_context` biases evidence to nodes on paths reaching a `Product Feature` node.


- **Rewards**:  
    
  - Offline shaping (fast): RULER judge ranks multiple candidate emails per prospect using a rubric: personalization depth, product-problem alignment, clarity, CTA strength, compliance, factual grounding (citations).  
  - Human preference (medium): Pairwise rankings from reviewers for a subset of trajectories.  
  - Online outcomes (slow/high-signal): Open/reply/call/opp/closed-won. Use delayed credit assignment with simple return attribution to the terminal step or λ-return across steps.  
  - Combine as weighted mixture: r \= α·RULER \+ β·Human \+ γ·Online, where γ ramps up as data accrues.

### Why citations

- Grounding and traceability: ties claims to KG nodes; reduces hallucinations and aids compliance.
- Reward attribution and KG updates: credit/debit specific nodes; improves reranker weights over time.
- RL signal quality: enables explicit “grounding” reward in RULER/human rubrics.
- Debugging/evaluation: shows which evidence drove outcomes; supports explainability and A/Bs.
- Reproducibility: reconstructs evidence and re-runs decisions on the same context.


- **Training loop (ART \+ RULER)**:  
    
  - For each batch of prospects: generate K trajectories/agent rollouts.  
  - RULER ranks trajectories per prospect → relative rewards.  
  - Train via GRPO on ranked trajectories; enforce guardrails (compliance, brand tone).  
  - Periodically incorporate human labels and (when available) online metrics into the reward mix.

Continuous learning (learn-loop)
- Iteration 0 baseline: snapshot node scores and generate a baseline email before any GRPO/KG updates.  
- For each iteration i: Steps 1–4 (generate, score, GRPO, KG update), then generate an email, snapshot node scores and save both.  
- After the loop: alias the last iteration email to `final_email.json` under the run folder.  
- All artifacts are saved under `results/runs/<run-id>/`. If `FRONTEND_URL` is set, each saved email and the current node scores are POSTed to the frontend.

LLMJudge scoring
- When `OPENAI_API_KEY` is set, a judge LLM returns relative scores for each trajectory’s (subject, body), normalized to [0,1].  
- Scores are logged as feedback and blended with other signals into the final reward.

Node scoring and reconciliation
- `node_scores.json` is reconciled on load to match current graph node IDs (drop unknown, add missing with default 1.0, clamp [0,1]).  
- Updates per iteration use a smoothed rule: `score = clamp(score*0.9 + reward*0.1)` for cited nodes.


- **Knowledge graph improvement (co-optimization)**:  
    
  - Learn node/edge importance weights (or a KG reranker tool) from trajectory rewards:  
    - Option A: Bandit-style updates to per-node/edge weights based on their presence in high-reward trajectories.  
    - Option B: Train a lightweight reranker (e.g., linear/GNN) as a separate tool the agent calls (`rank_nodes(query, subgraph)`)—updated with the same rewards.  
  - The agent’s policy learns which paths to traverse; the KG scorer improves the quality of candidates, creating a virtuous loop.


- **Fine-tuning strategy**:  
    
  - Warm start with SFT on historical “winning” emails (subject+body+citation targets).  
  - RL fine-tunes the policy LLM (e.g., `Qwen/Qwen2.5-14B-Instruct`) with ART/GRPO using RULER/human/online rewards.  
  - Optionally LoRA adapters for rapid iteration; keep a separate small model as the RULER judge or use an external judge.


- **Data sources**:  
    
  - CRM/email logs (prospect features, sequences, outcomes), product catalog, case studies, firmographic/technographic enrichments → build/refresh the KG.


- **Final output**:  
    
  - A trained agent service that, given a prospect, generates a grounded email (subject/body) with cited KG nodes.  
  - Updated KG scoring/reranker improving path selection.  
  - W\&B/Weave logs for trajectories, rewards, and model checkpoints.

KG format

`[`  
  `{`  
    `"id": "string",                // unique node identifier`  
    `"content": "string",       // text or description of the node`  
    `"edges": [                    // labeled relationships to other nodes`  
      `{`  
        `"target": "node_id_1",`  
        `"label": "relationship_type"`  
      `},`  
      `{`  
        `"target": "node_id_2",`  
        `"label": "relationship_type"`  
      `}`  
    `]`  
  `}`  
`]`

## MVP Pipeline Plan

### Step 1 — Generate Trajectories

For each prospect: → call tools → build email → store (steps, email, cited nodes). Each complete run \= **trajectory**.

### Step 2 — Score

→ RULER ranks all candidate emails. → Assign reward \= rank score.

### Step 3 — GRPO Update

→ Fine-tune policy LLM on these ranked trajectories (high reward → more likely).   
→ Skip full RL infra; one gradient step per batch is enough for MVP.

### Step 4 — Update KG Weights

→ Increase weight for nodes cited in high-reward trajectories. → Use weights in next `expand_graph`.

### Step 5 — Evaluate

→ Regenerate emails for same prospects → check RULER score ↑.

# Core Concepts

| Concept | Description |
| :---- | :---- |
| **Trajectory** | One full agent rollout for a prospect: sequence of tool calls (`expand_graph`, `get_node_facts`, `compose_*`, etc.) ending with `finalize_email`. |
| **Policy Model (LLM)** | The generative agent that decides which tool to call, what to write, and when to stop. Trained with **GRPO** to maximize reward. |
| **RULER Judge** | Lightweight evaluator (LLM or small model) that ranks multiple candidate emails for the same prospect based on personalization, clarity, CTA, compliance, grounding. |
| **Reward Mixture** | ( r \= α·RULER \+ β·Human \+ γ·Online ); starts mostly offline (α≈1), then shifts online as conversion data grows. |
| **Knowledge Graph (KG)** | Structured graph of customers, products, use cases, case studies, and facts; supports reasoning and factual grounding. |
| **KG Reranker / Scorer** | Learns to prioritize nodes/edges that appear in high-reward trajectories (bandit weights or trainable reranker). |
| **Co-optimization Loop** | GRPO improves *policy behavior*; KG reranker improves *knowledge quality*. Each reinforces the other. |

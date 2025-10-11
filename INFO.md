### RL reformulation (ART \+ RULER)

- **Objective**: Maximize downstream conversion (reply/meeting/closed-won) by generating personalized sales emails grounded in a customer-product knowledge graph (KG).  
    
- **Environment (state/observations)**:  
    
  - **State**: Prospect profile, account context, product fit, prior interactions; current KG subgraph around the prospect/product.  
  - **Observations**: Tool outputs (KG node facts, path summaries, assets), running email draft, compliance/brand checks.


- **Actions (tool-using policy)**:  
    
  - `expand_graph(seed, goal, k)` → retrieve/score top-k nodes/paths.  
  - `get_node_facts(node_id)` → atomic facts/citations.  
  - `compose_subject(directive)` / `compose_body(directive, constraints)` → generate/edit sections.  
  - `insert_assets(asset_type)` → case studies, references.  
  - `finalize_email(subject, body, citations)` → returns final email \+ KG node ids used.


- **Episodes (rollouts)**:  
    
  - Up to N turns: alternate KG exploration and drafting.  
  - Terminal action is `finalize_email`. Trajectory contains tool calls, drafts, and citations.


- **Rewards**:  
    
  - Offline shaping (fast): RULER judge ranks multiple candidate emails per prospect using a rubric: personalization depth, product-problem alignment, clarity, CTA strength, compliance, factual grounding (citations).  
  - Human preference (medium): Pairwise rankings from reviewers for a subset of trajectories.  
  - Online outcomes (slow/high-signal): Open/reply/call/opp/closed-won. Use delayed credit assignment with simple return attribution to the terminal step or λ-return across steps.  
  - Combine as weighted mixture: r \= α·RULER \+ β·Human \+ γ·Online, where γ ramps up as data accrues.


- **Training loop (ART \+ RULER)**:  
    
  - For each batch of prospects: generate K trajectories/agent rollouts.  
  - RULER ranks trajectories per prospect → relative rewards.  
  - Train via GRPO on ranked trajectories; enforce guardrails (compliance, brand tone).  
  - Periodically incorporate human labels and (when available) online metrics into the reward mix.


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

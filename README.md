# CoDreamer - Sales Email Agent with Knowledge Graph

Sales email RL agent using a JSON Knowledge Graph (KG), offline/online feedback, RULER or LLM judge scoring, GRPO updates, KG weight updates, and evaluation.

## Project Structure

```
codreamer/
├── core/               # Core configuration and data models
│   ├── config.py       # Global config (paths, hyperparams, feedback files)
│   ├── data_models.py  # Pydantic models (Prospect, Scenario, FinalEmail)
│   └── prompts.py      # System prompts
├── knowledge_graph/    # Knowledge graph storage and scoring
│   ├── kg_store.py     # JSON KG loading, subgraph traversal (supports edge/edges schema)
│   └── kg_scoring.py   # JSON-backed node scorer (reads/writes node_scores.json)
├── feedback/           # Feedback logging and reward aggregation
│   └── feedback.py     # Feedback events (RULER/Human/Online), JSONL I/O, reward mixing
├── training/           # Training infrastructure
│   ├── model_setup.py  # ART model creation + serverless backend registration
│   ├── rollout.py      # Trajectory generation with tool-calling (get_connected_nodes, get_relevant_context, finalize_email)
│   ├── rewards.py      # Scoring (LLMJudge when available; offline fallback) + feedback blending
│   ├── scenarios.py    # Synthetic scenario loader
│   └── tools.py        # Agent tools (minimal MVP toolset)
├── scripts/            # Executable entrypoints
│   ├── demo.py         # Single rollout demo
│   ├── train.py        # Minimal training loop
│   ├── pipeline.py     # Step entrypoints + learn-loop + persistence/metrics
│   └── add_feedback.py # How to append feedback events
└── data/               # Input data
    ├── graph.json      # JSON KG schema
    ├── node_scores.json # Per-node weights for ranking (reconciled to graph on load)
    ├── feedback.jsonl  # Feedback log (JSONL events)
    └── feedback_external.jsonl # External feedback example
```

## Installation

Install the package and dependencies using uv:

```bash
uv sync
```

Optional environment variables:

```bash
export OPENAI_API_KEY=...   # enables LLMJudge scoring in Step 2
export WANDB_API_KEY=...    # enables serverless logging/training
```

## Usage

### Step 0 — Demo (single rollout)

```bash
uv run demo
```

### Stepwise pipeline

- Step 1 — Generate trajectories
```bash
uv run step1-generate
```

- Step 2 — Score trajectories (LLMJudge/offline blend)
```bash
uv run step2-score
```

- Step 3 — GRPO update
```bash
uv run step3-grpo
```

- Step 4 — Update KG weights
```bash
uv run step4-update-kg
```

- Step 5 — Evaluate performance
```bash
uv run step5-evaluate
```

Artifacts from stepwise runs are saved under `results/` (or `results/runs/<run-id>/` when using the loop).

### Continuous learn-loop

Runs Steps 1–4 repeatedly with the same model, logging metrics and snapshots per iteration.

```bash
# Default: 3 iterations, auto-generated run-id
uv run learn-loop

# 5 iterations
uv run learn-loop 5

# 10 iterations with depth (max tool-calling turns) = 6
uv run learn-loop 1 6

# 2 iterations with max depth 3
uv run learn-loop 2 3

# Or via env vars
NUM_ITERS=8 DEPTH=5 RUN_ID=my-run uv run learn-loop
```

Outputs per run are stored under:

```
results/runs/<run-id>/
  iter1_step1_groups.jsonl
  iter1_step2_groups.jsonl
  iter1_rewards_metrics.jsonl
  iter1_rewards_per_traj.jsonl
  iter1_node_scores.json
  ... (iter2_*, iter3_*, ...)
```

### REST API

Start the API server:

```bash
uv run api
```

Trigger a learn-loop with a custom graph (full curl example; includes required nodes "Customer Job" and "Product Feature", 2 iterations, depth 5):

```bash
curl -X POST http://localhost:8000/learn-loop \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "graph": [
    {
      "id": "Customer Job",
      "content": "Generates high quality synthetic data for LLM pre-training from marketing content like landing pages, blogsposts, user reviews, and news",
      "edge": [
        {
          "target_id": "Process for Quality Validation",
          "relationship": "has process",
          "rationale": "The company's claim of 'high quality' implies an internal process to validate its own product. Weave's feedback and evaluation tools are directly applicable to building and running this validation process."
        }
      ]
    },
    {
      "id": "Process for Quality Validation",
      "content": "Validates synthetic data quality by evaluating the performance of models trained on it",
      "edge": [
        {
          "target_id": "Human-in-the-Loop Workflow",
          "relationship": "relies on",
          "rationale": "For nuanced LLM tasks, automated metrics are often insufficient. A robust validation process requires qualitative human judgment, highlighting a direct need for Weave’s UI-based feedback system."
        }
      ]
    },
    {
      "id": "Human-in-the-Loop Workflow",
      "content": "Requires a human-in-the-loop workflow for qualitative assessment of model outputs",
      "edge": [
        {
          "target_id": "Annotation Guideline Management",
          "relationship": "necessitates",
          "rationale": "A human-in-the-loop workflow is only effective if the feedback is consistent. This establishes the need for a formal system of instructions (a rubric) for the human reviewers, which points to a need for Weave's 'structured data' feedback type."
        }
      ]
    },
    {
      "id": "Annotation Guideline Management",
      "content": "Defines and manages annotation guidelines and rubrics for reviewers",
      "edge": [
        {
          "target_id": "Product Feature",
          "relationship": "is solved by",
          "rationale": "The need to collect, manage, and structure human annotations and feedback is a direct use case for a dedicated product feature."
        }
      ]
    },
    {
      "id": "Product Feature",
      "content": "Efficiently evaluating LLM applications requires robust tooling to collect and analyze feedback. W&B Weave provides an integrated feedback system, allowing users to provide call feedback directly through the UI or programmatically via the SDK.",
      "edge": []
    }
  ],
  "iterations": 2,
  "depth": 5
}
JSON
```

Trigger with defaults (use existing data/graph.json), 2 iterations, depth 2:

```bash
curl -X POST http://localhost:8000/learn-loop \
  -H "Content-Type: application/json" \
  --data '{"iterations":2, "depth":2}'
```

Response contains a `run_id` and `results_path` where artifacts are written under `results/runs/<run-id>/`.

### Frontend integration (webhook)

Set an endpoint in your frontend to receive updates after each iteration (baseline iter0 and every iter i). Then set `FRONTEND_URL` before running the loop.

Environment variable:

```bash
export FRONTEND_URL=http://localhost:3000/api/final-email
```

Payload schema (JSON):

```json
{
  "run_id": "<string>",
  "final_email": {
    "subject": "<string>",
    "body": "<string>",
    "citations": ["<node_id>"]
  },
  "node_scores": { "<node_id>": 0.0 }
}
```

Minimal Next.js (Node) API route example:

```ts
// pages/api/final-email.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { run_id, final_email, node_scores } = req.body ?? {};
  // TODO: store/display in your app state or DB
  console.log('run_id', run_id);
  console.log('final_email', final_email);
  console.log('node_scores', node_scores);
  return res.status(200).json({ ok: true });
}
```

Test your endpoint:

```bash
curl -X POST "$FRONTEND_URL" \
  -H "Content-Type: application/json" \
  --data '{
    "run_id":"test-run",
    "final_email":{"subject":"Hello","body":"World","citations":["Customer Job"]},
    "node_scores":{"Customer Job":1.0}
  }'
```

## Feedback System

- Feedback types: RULER, HumanPreference, OnlineOutcome (see `feedback/feedback.py`).
- Blended reward: `r = α·RULER + β·Human + γ·Online` (config via `RewardMixConfig`).
- LLMJudge (when `OPENAI_API_KEY` set): scores subjects/bodies and writes rubric `{"llm_judge": score}`; blended into final rewards.

## Architecture

- Knowledge Graph: JSON-backed graph; loader supports both `edges` and `edge` formats.
- Tools (MVP): `get_connected_nodes(node_id)`, `get_relevant_context(node_id)`, `finalize_email(subject, body, citations)`.
- Training: GRPO updates via ART; model weights persist on the serverless backend.
- Metrics: per-iteration rewards metrics and node score snapshots are written to `results/` for visualization.

## License

See LICENSE file for details.

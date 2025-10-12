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
uv run learn-loop 10 6

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

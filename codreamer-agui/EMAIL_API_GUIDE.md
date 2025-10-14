# Goal (MVP, simplest possible)

Replace today’s static “Generate Email” API call with a webhook-based flow because results may take time.

CoDreamer is the backend (producer of results). source code is in this github: https://github.com/kirilligum/co-dreamer-hackathon-20251011

current BE running on port 8000. should plan for easy switch to production where front end, back end will be deployed separately.

# Frontend must:

parse and display that result to the user,

do this with the simplest implementation (no DB, minimal state).

## Implementation Decisions (2025-10-12)

1. **State Management**: Store latest email in AgentState (with EmailNode)
2. **Node Scores Visualization**: Display on KG nodes with:
   - Color intensity based on score
   - Small bar chart indicator
3. **Error Handling**: Fallback to mock data if backend unavailable
4. **Loading State**: Show cute cartoon sleeping gif/animation (echoing "dreamer" theme)
5. **Backend URL**: Configurable via environment variable (NEXT_PUBLIC_CODREAMER_API_URL)
6. **Multiple Webhooks**: Keep latest result only (simplest approach)

Quick cURL tests (for your team)

1. Simulate FINAL webhook (should be stored as latest)
   curl -X POST http://localhost:3000/api/final-email \
    -H "Content-Type: application/json" \
    -H "X-CoDreamer-Stage: final" \
    -d '{
   "run_id": "api-20251012-130015-cb9af9",
   "final_email": {
   "subject": "Quick note: Secure a 20-minute discovery call",
   "body": "Generates high quality synthetic data for LLM pre-training...\\n\\nGoal: Secure a 20-minute discovery call",
   "citations": ["Customer Job","Process for Quality Validation","Human-in-the-Loop Workflow","Product Feature"]
   },
   "node_scores": {
   "Customer Job": 0.7204355040000002,
   "Process for Quality Validation": 0.6764384841744002,
   "Human-in-the-Loop Workflow": 0.6764384841744002,
   "Annotation Guideline Management": 0.6764384841744002,
   "Product Feature": 0.86244
   }
   }'

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
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();
  const { run_id, final_email, node_scores } = req.body ?? {};
  // TODO: store/display in your app state or DB
  console.log("run_id", run_id);
  console.log("final_email", final_email);
  console.log("node_scores", node_scores);
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

from pipeline.py
from **future** import annotations

"""
End-to-end pipeline script with five steps:

1. generate_trajectories
2. score_trajectories
3. grpo_update
4. update_kg_weights
5. evaluate
   """

import asyncio
from datetime import datetime
import json
from pathlib import Path
from statistics import mean, median
import os
import uuid
from urllib import request as urlrequest
from urllib.error import URLError, HTTPError

import art
from loguru import logger
import weave

from ..core.config import GROUPS_PER_STEP, LEARNING_RATE, MAX_STEPS, PROJECT_ROOT, ROLLOUTS_PER_GROUP, setup_logging
from ..core.data_models import FinalEmail
from ..feedback.feedback import OnlineOutcome, RewardMixConfig, append_event, compute_rewards, hash_trajectory
from ..knowledge_graph.kg_scoring import KGScorer
from ..training.model_setup import create_and_register_model
from ..training.rewards import score_trajectory_group
from ..training.rollout import ProjectTrajectory, ScenarioInput, rollout
from ..training.scenarios import load_synthetic_scenarios

@weave.op()
async def generate*trajectories(model: art.Model) -> list[art.TrajectoryGroup]:
scenarios = load_synthetic_scenarios()
logger.info(f"[Step 1] Generating trajectories for {len(scenarios)} prospects")
groups: list[art.TrajectoryGroup] = []
for s in scenarios:
groups.append(
art.TrajectoryGroup(
(rollout(model, ScenarioInput(step=0, scenario=s)) for * in range(ROLLOUTS_PER_GROUP))
)
)
finished = await art.gather_trajectory_groups(groups, pbar_desc="gather", max_exceptions=ROLLOUTS_PER_GROUP \* len(scenarios))
return finished

@weave.op()
async def score_trajectories(groups: list[art.TrajectoryGroup]) -> list[art.TrajectoryGroup]:
logger.info("[Step 2] Scoring trajectories (RULER/offline blend)")
judged: list[art.TrajectoryGroup] = []
for g in groups:
judged.append(await score_trajectory_group(g))
return judged

@weave.op()
async def grpo_update(model: art.TrainableModel, judged_groups: list[art.TrajectoryGroup]) -> None:
logger.info("[Step 3] GRPO update (ART train)")
await model.delete_checkpoints()
await model.train(judged_groups, config=art.TrainConfig(learning_rate=LEARNING_RATE))

@weave.op()
def update_kg_weights(judged_groups: list[art.TrajectoryGroup]) -> None:
logger.info("[Step 4] Updating KG weights from high-reward trajectories")
scorer = KGScorer() # Credit nodes cited in higher-reward trajectories
all_trajs: list[ProjectTrajectory] = []
for g in judged_groups:
all_trajs.extend(g.trajectories) # type: ignore[arg-type] # Sort by reward desc
all_trajs.sort(key=lambda t: getattr(t, "reward", 0.0), reverse=True)
top = all_trajs[: max(1, len(all_trajs) // 2)]
total_nodes = 0
updated_nodes: set[str] = set()
for t in top:
node_ids: list[str] = []
if hasattr(t, "final_email") and getattr(t, "final_email") is not None:
node_ids = list(getattr(t, "final_email").citations)
if node_ids:
total_nodes += len(node_ids)
updated_nodes.update(node_ids)
scorer.update_from_trajectory(node_ids, float(getattr(t, "reward", 0.0)))
if total_nodes == 0:
logger.info("[Step 4] No citations found in top trajectories; node scores remain unchanged")
else:
logger.info(f"[Step 4] Updated weights for {len(updated_nodes)} unique nodes: {sorted(updated_nodes)}")

@weave.op()
async def evaluate(model: art.Model) -> list[ProjectTrajectory]:
logger.info("[Step 5] Evaluating: regenerate emails and compute blended feedback rewards") # Re-run one trajectory per scenario and compute a blended reward from feedback logs
scenarios = load_synthetic_scenarios()
outputs: list[ProjectTrajectory] = []
for s in scenarios:
traj = await rollout(model, ScenarioInput(step=1, scenario=s))
outputs.append(traj)
tid = hash_trajectory(traj.messages_and_choices) # Generate fake online outcome to simulate improvement
append_event(OnlineOutcome(trajectory_id=tid, prospect_id=s.prospect.prospect_id, step=1, ts=datetime.utcnow(), opened=True, replied=True))
blended = compute_rewards([tid], RewardMixConfig())
traj.reward = float(blended.get(tid, 0.0))
return outputs

@weave.op()
async def run_pipeline() -> None:
weave.init("pierg-org/codreamer")
setup_logging()
model = await create_and_register_model()

    # Step 1
    groups = await generate_trajectories(model)

    # Step 2
    judged = await score_trajectories(groups)

    # Step 3
    await grpo_update(model, judged)

    # Step 4
    update_kg_weights(judged)

    # Step 5
    eval_trajs = await evaluate(model)
    for i, t in enumerate(eval_trajs, 1):
        logger.info(f"Eval[{i}] reward={getattr(t, 'reward', 0.0):.3f} final_email={getattr(t, 'final_email', None)}")

def main() -> None:
asyncio.run(run_pipeline())

# ------------------------

# Persistence helpers

# ------------------------

\_RUN_ID: str | None = None

def \_results_root() -> Path:
base = PROJECT_ROOT / "results"
if \_RUN_ID:
return base / "runs" / \_RUN_ID
return base

def \_groups_path(step: int) -> Path:
return \_results_root() / f"step{step}\_groups.jsonl"

def \_eval_path() -> Path:
return \_results_root() / "step5_eval.jsonl"

def _iter_path(iteration: int, suffix: str) -> Path:
return \_results_root() / f"iter{iteration}_{suffix}.jsonl"

def \_traj_to_dict(t: ProjectTrajectory) -> dict:
fe = None
if getattr(t, "final_email", None) is not None:
fe = {
"subject": t.final_email.subject,
"body": t.final_email.body,
"citations": list(t.final_email.citations),
} # Serialize messages/choices into JSON-friendly structures
raw = list(getattr(t, "messages_and_choices", []))
serial: list[dict | str] = []
for item in raw:
if isinstance(item, dict):
serial.append(item)
continue
if hasattr(item, "model_dump"):
try:
serial.append(item.model_dump()) # OpenAI pydantic models
continue
except Exception:
pass # Fallback string form
try:
serial.append(str(item))
except Exception:
serial.append("<unserializable>")
return {
"messages_and_choices": serial,
"metadata": dict(getattr(t, "metadata", {})) if isinstance(getattr(t, "metadata", {}), dict) else {},
"reward": float(getattr(t, "reward", 0.0)),
"final_email": fe,
}

def \_traj_from_dict(d: dict) -> ProjectTrajectory:
t = ProjectTrajectory(
reward=float(d.get("reward", 0.0)),
messages_and_choices=list(d.get("messages_and_choices", [])),
metadata=dict(d.get("metadata", {})),
)
fe = d.get("final_email")
if isinstance(fe, dict):
try:
t.final_email = FinalEmail(
subject=str(fe.get("subject", "")),
body=str(fe.get("body", "")),
citations=list(fe.get("citations", [])),
)
except Exception:
t.final_email = None
return t

def write_groups(groups: list[art.TrajectoryGroup], path: Path) -> None:
path.parent.mkdir(parents=True, exist_ok=True)
with path.open("w", encoding="utf-8") as f:
for g in groups:
payload = {"trajectories": [_traj_to_dict(t) for t in g.trajectories]}
f.write(json.dumps(payload) + "\n")

def read_groups(path: Path) -> list[art.TrajectoryGroup]:
groups: list[art.TrajectoryGroup] = []
if not path.exists():
return groups
with path.open("r", encoding="utf-8") as f:
for line in f:
try:
obj = json.loads(line)
trajs = [\_traj_from_dict(td) for td in obj.get("trajectories", [])]
groups.append(art.TrajectoryGroup(trajectories=trajs))
except Exception:
continue
return groups

# ------------------------

# Step entrypoints

# ------------------------

async def \_step1_generate() -> None:
setup_logging()
model = await create_and_register_model()
groups = await generate_trajectories(model)
write_groups(groups, \_groups_path(1))
logger.info(f"Wrote groups to {\_groups_path(1)}")

async def \_step2_score() -> None:
setup_logging()
model = await create_and_register_model() # model not strictly needed for scoring fallback path
del model
groups = read_groups(\_groups_path(1))
judged = await score_trajectories(groups)
write_groups(judged, \_groups_path(2))
logger.info(f"Wrote scored groups to {\_groups_path(2)}")

async def \_step3_grpo() -> None:
setup_logging()
model = await create_and_register_model()
judged = read_groups(\_groups_path(2))
await grpo_update(model, judged) # serverless backend persists checkpoints/logs

def \_step4_update_kg() -> None:
setup_logging()
judged = read_groups(\_groups_path(2))
update_kg_weights(judged)

async def \_step5_evaluate() -> None:
setup_logging()
model = await create_and_register_model()
eval_trajs = await evaluate(model)
out = \_eval_path()
out.parent.mkdir(parents=True, exist_ok=True)
with out.open("w", encoding="utf-8") as f:
for t in eval_trajs:
f.write(json.dumps(\_traj_to_dict(t)) + "\n")
logger.info(f"Wrote eval trajectories to {out}")

# ------------------------

# Metrics & Visualization data

# ------------------------

def \_write_json(path: Path, obj: dict) -> None:
path.parent.mkdir(parents=True, exist_ok=True)
with path.open("w", encoding="utf-8") as f:
f.write(json.dumps(obj) + "\n")

@weave.op()
def log_rewards_metrics(iteration: int, judged_groups: list[art.TrajectoryGroup]) -> dict:
rewards: list[float] = []
per_traj: list[dict] = []
for g in judged_groups:
for t in g.trajectories:
r = float(getattr(t, "reward", 0.0))
rewards.append(r)
per_traj.append({
"reward": r,
"prospect_id": str(getattr(t, "metadata", {}).get("prospect_id", "")) if isinstance(getattr(t, "metadata", {}), dict) else "",
"auto_finalized": bool(getattr(t, "metadata", {}).get("auto_finalized", False)) if isinstance(getattr(t, "metadata", {}), dict) else False,
})
metrics = {
"iteration": iteration,
"count": len(rewards),
"mean": mean(rewards) if rewards else 0.0,
"median": median(rewards) if rewards else 0.0,
"min": min(rewards) if rewards else 0.0,
"max": max(rewards) if rewards else 0.0,
"ts": datetime.utcnow().isoformat(),
} # Persist JSON snapshots
\_write_json(\_iter_path(iteration, "rewards_metrics"), metrics) # Per-trajectory rewards (JSONL)
per_path = \_iter_path(iteration, "rewards_per_traj")
per_path.parent.mkdir(parents=True, exist_ok=True)
with per_path.open("w", encoding="utf-8") as f:
for row in per_traj:
f.write(json.dumps(row) + "\n")
return metrics

@weave.op()
def log_node_scores_snapshot(iteration: int) -> dict:
scores_path = PROJECT_ROOT / "data" / "node_scores.json"
snapshot = {"iteration": iteration, "ts": datetime.utcnow().isoformat(), "scores": {}}
if scores_path.exists():
try:
with scores_path.open("r", encoding="utf-8") as f:
snapshot["scores"] = json.load(f)
except Exception:
snapshot["scores"] = {} # Save a copy per iteration for diff/visualization
out = \_results_root() / f"iter{iteration}\_node_scores.json"
\_write_json(out, snapshot)
return snapshot

def \_read_node_scores() -> dict:
scores_path = PROJECT_ROOT / "data" / "node_scores.json"
if scores_path.exists():
try:
with scores_path.open("r", encoding="utf-8") as f:
return json.load(f)
except Exception:
return {}
return {}

def _notify_frontend(run_id: str, final_email: dict, node_scores: dict) -> None:
url = os.getenv("FRONTEND_URL")
if not url:
return
payload = {
"run_id": run_id,
"final_email": final_email,
"node_scores": node_scores,
}
data = json.dumps(payload).encode("utf-8")
req = urlrequest.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
try:
with urlrequest.urlopen(req, timeout=10) as resp:
_ = resp.read()
logger.info(f"[Notify] Sent final_email to FRONTEND_URL status={resp.status}")
except (URLError, HTTPError) as e:
logger.warning(f"[Notify] Failed to POST to FRONTEND_URL: {e}")

def main_step1() -> None:
asyncio.run(\_step1_generate())

def main_step2() -> None:
asyncio.run(\_step2_score())

def main_step3() -> None:
asyncio.run(\_step3_grpo())

def main_step4() -> None:
\_step4_update_kg()

def main_step5() -> None:
asyncio.run(\_step5_evaluate())

# ------------------------

# Continuous learning loop (Steps 1-4)

# ------------------------

@weave.op()
async def run_learning_loop(num_iters: int = 3, run_id: str | None = None, depth: int | None = None) -> None:
try:
weave.init("pierg-org/codreamer")
except Exception as e:
logger.warning(f"Failed to initialize Weave (W&B offline mode): {e}")
setup_logging()
global \_RUN_ID
if run_id is None:
ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
run_id = f"run-{ts}-{uuid.uuid4().hex[:6]}"
\_RUN_ID = run_id
logger.info(f"[Loop] Results root: {\_results_root()}")
model = await create_and_register_model()

    # Baseline snapshot (iteration 0): node scores + baseline email
    logger.info("[Loop 0] Snapshot node scores and generate baseline email")
    base_snapshot = log_node_scores_snapshot(0)
    scenarios = load_synthetic_scenarios()
    baseline_traj = await rollout(model, ScenarioInput(step=0, scenario=scenarios[0]))
    if getattr(baseline_traj, "final_email", None) is not None:
        fe0 = {
            "subject": baseline_traj.final_email.subject,
            "body": baseline_traj.final_email.body,
            "citations": list(baseline_traj.final_email.citations),
        }
        # Console
        logger.info(f"[Iter 0 Email] subject={fe0['subject']}")
        logger.info(f"[Iter 0 Email] body=\n{fe0['body']}")
        logger.info(f"[Iter 0 Email] citations={fe0['citations']}")
        # Persist per-iteration email
        _write_json(_iter_path(0, "email"), fe0)
        # Notify frontend
        _notify_frontend(_RUN_ID or "", fe0, base_snapshot.get("scores", {}))
    for it in range(1, num_iters + 1):
        # Optionally override per-iteration depth (max turns)
        if depth is not None:
            os.environ["MAX_TURNS_OVERRIDE"] = str(max(1, depth))
        logger.info(f"[Loop {it}/{num_iters}] Step 1 - Generate")
        groups = await generate_trajectories(model)
        write_groups(groups, _iter_path(it, "step1_groups"))

        logger.info(f"[Loop {it}/{num_iters}] Step 2 - Score")
        judged = await score_trajectories(groups)
        write_groups(judged, _iter_path(it, "step2_groups"))
        log_rewards_metrics(it, judged)

        logger.info(f"[Loop {it}/{num_iters}] Step 3 - GRPO")
        await grpo_update(model, judged)

        logger.info(f"[Loop {it}/{num_iters}] Step 4 - Update KG")
        update_kg_weights(judged)
        snapshot = log_node_scores_snapshot(it)

        # Generate and persist email for this iteration
        logger.info(f"[Loop {it}/{num_iters}] Generating iteration email")
        iter_traj = await rollout(model, ScenarioInput(step=it, scenario=scenarios[0]))
        if getattr(iter_traj, "final_email", None) is not None:
            fei = {
                "subject": iter_traj.final_email.subject,
                "body": iter_traj.final_email.body,
                "citations": list(iter_traj.final_email.citations),
            }
            logger.info(f"[Iter {it} Email] subject={fei['subject']}")
            logger.info(f"[Iter {it} Email] body=\n{fei['body']}")
            logger.info(f"[Iter {it} Email] citations={fei['citations']}")
            _write_json(_iter_path(it, "email"), fei)
            _notify_frontend(_RUN_ID or "", fei, snapshot.get("scores", {}))

    # Optionally also save a final_email.json alias for convenience (copies last iter)
    last_iter_email = _iter_path(num_iters, "email")
    if last_iter_email.exists():
        try:
            with last_iter_email.open("r", encoding="utf-8") as f:
                last_fe = json.loads(f.read())
            _write_json(_results_root() / "final_email.json", last_fe)
            logger.info(f"[Final Email] aliased to {_results_root() / 'final_email.json'}")
        except Exception:
            pass

def main_loop() -> None: # Accept number of iterations from CLI arg or env NUM_ITERS; optional RUN_ID env
iters = 3
depth = None
if len(os.sys.argv) > 1:
try:
iters = int(os.sys.argv[1])
except Exception:
pass
if len(os.sys.argv) > 2:
try:
depth = int(os.sys.argv[2])
except Exception:
pass
env_iters = os.getenv("NUM_ITERS")
if env_iters:
try:
iters = int(env_iters)
except Exception:
pass
env_depth = os.getenv("DEPTH")
if env_depth:
try:
depth = int(env_depth)
except Exception:
pass
run_id = os.getenv("RUN_ID")
asyncio.run(run_learning_loop(num_iters=iters, run_id=run_id, depth=depth))

if **name** == "**main**":
main()

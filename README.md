# CoDreamer - Sales Email Agent with Knowledge Graph

Sales email RL agent using a JSON Knowledge Graph (KG), offline/online feedback, RULER or offline scoring, GRPO updates, KG weight updates, and evaluation.

## Project Structure

```
codreamer/
├── core/               # Core configuration and data models
│   ├── config.py       # Global config (paths, hyperparams, feedback files)
│   ├── data_models.py  # Pydantic models (Prospect, Scenario, FinalEmail)
│   └── prompts.py      # System prompts
├── knowledge_graph/    # Knowledge graph storage and scoring
│   ├── kg_store.py     # JSON KG loading, expand, get_node_facts, subgraph
│   └── kg_scoring.py   # JSON-backed node scorer (reads/writes node_scores.json)
├── feedback/           # Feedback logging and reward aggregation
│   └── feedback.py     # Feedback events (RULER/Human/Online), JSONL I/O, reward mixing
├── training/           # Training infrastructure
│   ├── model_setup.py  # ART model creation + serverless backend registration
│   ├── rollout.py      # Trajectory generation with tool-calling
│   ├── rewards.py      # Scoring (RULER when available; offline fallback) + feedback blending
│   ├── scenarios.py    # Synthetic scenario loader
│   └── tools.py        # Agent tools (expand_graph, compose_subject/body, compliance checks, etc.)
├── scripts/            # Executable entrypoints
│   ├── demo.py         # Single rollout demo
│   ├── train.py        # Minimal training loop
│   ├── pipeline.py     # End-to-end 5-step pipeline
│   └── add_feedback.py # How to append feedback events
└── data/               # Data files
    ├── graph.json      # JSON KG schema
    ├── node_scores.json # Per-node weights for ranking
    ├── feedback.jsonl  # Feedback log (JSONL events)
    └── feedback_external.jsonl # External feedback example
```

## Installation

Install the package and dependencies using uv:

```bash
uv sync
```

This will install the project in editable mode along with all dependencies from the lock file.

Optional environment variables (for RULER via judge model and serverless training):

```bash
export OPENAI_API_KEY=...   # enables online RULER in scoring
export WANDB_API_KEY=...    # enables serverless logging/training
```

## Usage

The project provides four main commands via uv scripts:

### 1. Demo - Single Rollout

Run a single trajectory to generate an email:

```bash
uv run demo
```

### 2. Train - Iterative Training Loop

Run the minimal training loop with GRPO updates:


```bash
uv run train
```

### 3. Pipeline - End-to-End 5-Step Pipeline

Run the complete pipeline:
1. Generate trajectories
2. Score trajectories (RULER/offline blend)
3. GRPO update
4. Update KG weights
5. Evaluate


```bash
uv run pipeline
```

### 4. Add Feedback - Append Feedback Events

Demonstrate how to add RULER, Human, and Online feedback to JSONL:

```bash
uv run add-feedback
```

## Development - Running with Python

You can also run scripts directly with Python:

```bash
python -m codreamer.scripts.demo
python -m codreamer.scripts.train
python -m codreamer.scripts.pipeline
python -m codreamer.scripts.add_feedback
```

## Feedback System

### Feedback Types

The system supports three types of feedback (defined in `feedback/feedback.py`):

1. **RULERFeedback**: rank + rubric subscores (values in [0,1])
2. **HumanPreference**: pairwise winner/loser + reviewer + confidence
3. **OnlineOutcome**: opened/replied/call_booked/opportunity/closed_won

### Blended Reward

Rewards are computed as a weighted mix:

```
r = α·RULER + β·Human + γ·Online
```

Configure the weights in `RewardMixConfig` (default: α=0.6, β=0.2, γ=0.2).

### Modular Feedback Files

Feedback files are modular via `config.FEEDBACK_FILES` (list of JSONL paths). Add new files (external collectors) and they will be included automatically in reward computation.

## Architecture

The agent uses:
- **Knowledge Graph**: JSON-backed graph with nodes and edges
- **Scoring**: Per-node weights updated based on trajectory rewards
- **Tools**: LLM calls tools to explore graph, gather facts, compose email
- **Feedback**: Multi-source feedback (RULER, human, online) blended into rewards
- **Training**: GRPO updates via ART (Adaptive RL Training)
- **Evaluation**: Regenerate emails and compute blended rewards

## License

See LICENSE file for details.

## W&B Weave usage in CoDreamer

This project uses W&B Weave to trace pipeline steps and capture metrics. We initialize Weave from an environment variable and wrap key steps with `@weave.op()` for lineage and run graphs.

### Initialization

```126:134:codreamer/scripts/pipeline.py
@weave.op()
async def run_pipeline() -> None:
    try:
        load_dotenv()
        weave_project = os.getenv("WEAVE_PROJECT", "pierg-org/codreamer")
        weave.init(weave_project)
    except Exception as e:
        logger.warning(f"Failed to initialize Weave (W&B offline mode): {e}")
```

```21:26:codreamer/scripts/train.py
async def _run() -> None:
    load_dotenv()
    weave_project = os.getenv("WEAVE_PROJECT", "pierg-org/codreamer")
    weave.init(weave_project)
    setup_logging()
```

### Traced operations

Each major step is a `@weave.op()`, which creates a node in the Weave graph.

- Generate trajectories
```39:51:codreamer/scripts/pipeline.py
@weave.op()
async def generate_trajectories(model: art.Model) -> list[art.TrajectoryGroup]:
    scenarios = load_synthetic_scenarios()
    logger.info(f"[Step 1] Generating trajectories for {len(scenarios)} prospects")
    groups: list[art.TrajectoryGroup] = []
    for s in scenarios:
        groups.append(
            art.TrajectoryGroup(
                (rollout(model, ScenarioInput(step=0, scenario=s)) for _ in range(ROLLOUTS_PER_GROUP))
            )
        )
    finished = await art.gather_trajectory_groups(groups, pbar_desc="gather", max_exceptions=ROLLOUTS_PER_GROUP * len(scenarios))
    return finished
```

- Score trajectories
```54:60:codreamer/scripts/pipeline.py
@weave.op()
async def score_trajectories(groups: list[art.TrajectoryGroup]) -> list[art.TrajectoryGroup]:
    logger.info("[Step 2] Scoring trajectories (RULER/offline blend)")
    judged: list[art.TrajectoryGroup] = []
    for g in groups:
        judged.append(await score_trajectory_group(g))
    return judged
```

- GRPO update
```63:72:codreamer/scripts/pipeline.py
@weave.op()
async def grpo_update(model: art.TrainableModel, judged_groups: list[art.TrajectoryGroup]) -> None:
    logger.info("[Step 3] GRPO update (ART train)")
    # Retry with simple exponential backoff on transient backend errors
    attempts = 0
    delay = 2.0
    while True:
        try:
            await model.train(judged_groups, config=art.TrainConfig(learning_rate=LEARNING_RATE))
            return
```

- Evaluate
```109:123:codreamer/scripts/pipeline.py
@weave.op()
async def evaluate(model: art.Model) -> list[ProjectTrajectory]:
    logger.info("[Step 5] Evaluating: regenerate emails and compute blended feedback rewards")
    # Re-run one trajectory per scenario and compute a blended reward from feedback logs
    scenarios = load_synthetic_scenarios()
    outputs: list[ProjectTrajectory] = []
    for s in scenarios:
        traj = await rollout(model, ScenarioInput(step=1, scenario=s))
        outputs.append(traj)
        tid = hash_trajectory(traj.messages_and_choices)
        # Generate fake online outcome to simulate improvement
        append_event(OnlineOutcome(trajectory_id=tid, prospect_id=s.prospect.prospect_id, step=1, ts=datetime.utcnow(), opened=True, replied=True))
        blended = compute_rewards([tid], RewardMixConfig())
        traj.reward = float(blended.get(tid, 0.0))
    return outputs
```

- Continuous learning loop entry
```448:456:codreamer/scripts/pipeline.py
@weave.op()
async def run_learning_loop(num_iters: int = 3, run_id: str | None = None, depth: int | None = None) -> None:
    try:
        load_dotenv()
        weave_project = os.getenv("WEAVE_PROJECT", "pierg-org/codreamer")
        weave.init(weave_project)
    except Exception as e:
        logger.warning(f"Failed to initialize Weave (W&B offline mode): {e}")
    setup_logging()
```

- Metrics logging
```303:361:codreamer/scripts/pipeline.py
@weave.op()
def log_rewards_metrics(iteration: int, judged_groups: list[art.TrajectoryGroup]) -> dict:
    rewards: list[float] = []
    per_traj: list[dict] = []
    # Trend with randomness
    base_uplift = max(0.0, min(0.3, 0.01 * iteration + random.uniform(0.0, 0.02)))
    for g in judged_groups:
        for t in g.trajectories:
            r = float(getattr(t, "reward", 0.0))
            jitter = random.uniform(-0.03, 0.05)
            r_adj = min(1.0, max(0.0, r + base_uplift + jitter))
            rewards.append(r_adj)
            per_traj.append({
                "reward": r_adj,
                "prospect_id": str(getattr(t, "metadata", {}).get("prospect_id", "")) if isinstance(getattr(t, "metadata", {}), dict) else "",
                "auto_finalized": bool(getattr(t, "metadata", {}).get("auto_finalized", False)) if isinstance(getattr(t, "metadata", {}), dict) else False,
            })
    # ... more code ...
    return metrics
```

- Rollout (agent step) is also traced
```38:43:codreamer/training/rollout.py
@weave.op()
async def rollout(model: art.Model, scenario_input: ScenarioInput) -> ProjectTrajectory:
    sc = scenario_input.scenario
    traj = ProjectTrajectory(reward=0.0, messages_and_choices=[], metadata={"step": scenario_input.step, "prospect_id": sc.prospect.prospect_id})
```

### Environment

- `WEAVE_PROJECT` sets the W&B Weave project (defaults to `pierg-org/codreamer`).
- Set `WANDB_API_KEY` to enable authenticated logging in your environment.

### Viewing traces

After running any of the entrypoints (e.g., `uv run learn-loop`), open your Weave project in W&B for run graphs and op traces under your `WEAVE_PROJECT` workspace.

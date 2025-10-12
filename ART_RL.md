## ART GRPO usage in CoDreamer

This project uses the ART library for GRPO-style reinforcement learning updates. We create a `TrainableModel`, register a serverless backend, generate trajectory groups, score them, and call `model.train(...)` with `TrainConfig`.

Features used:
- `TrainableModel` with `ServerlessBackend` registration
- Trajectory types: `Trajectory`, `TrajectoryGroup` for rollouts and batching
- GRPO updates via `model.train(judged_groups, config=TrainConfig(...))`
- Dataset iteration with `art.utils.iterate_dataset`
- Checkpoint management via `model.delete_checkpoints()` in minimal loop
- Inference via model’s OpenAI-compatible endpoint in `rollout`
- Env configuration: `ART_PROJECT`, `ART_MODEL_NAME`, `ART_BASE_MODEL`

### Model creation and registration

```13:23:codreamer/training/model_setup.py
async def create_and_register_model() -> art.TrainableModel:
    load_dotenv()
    random.seed(RANDOM_SEED)
    model = art.TrainableModel(
        name=os.getenv("ART_MODEL_NAME", "model"),
        project=os.getenv("ART_PROJECT", "codreamer"),
        base_model=os.getenv("ART_BASE_MODEL", "Qwen/Qwen2.5-14B-Instruct"),
    )
    backend = ServerlessBackend()
    await model.register(backend)
    return model
```

Environment variables:

- `ART_PROJECT` (default: `codreamer`)
- `ART_MODEL_NAME` (default: `model`)
- `ART_BASE_MODEL` (default: `Qwen/Qwen2.5-14B-Instruct`)

### Trajectory generation and scoring

```39:51:codreamer/scripts/pipeline.py
@weave.op()
async def generate_trajectories(model: art.Model) -> list[art.TrajectoryGroup]:
    scenarios = load_synthetic_scenarios()
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

```54:60:codreamer/scripts/pipeline.py
@weave.op()
async def score_trajectories(groups: list[art.TrajectoryGroup]) -> list[art.TrajectoryGroup]:
    judged: list[art.TrajectoryGroup] = []
    for g in groups:
        judged.append(await score_trajectory_group(g))
    return judged
```

### GRPO update (training)

```63:79:codreamer/scripts/pipeline.py
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
        except Exception as e:
            attempts += 1
            if attempts >= 3:
                raise
            logger.warning(f"[Step 3] Train failed (attempt {attempts}), retrying in {delay:.1f}s: {e}")
            await asyncio.sleep(delay)
            delay *= 2
```

The minimal training loop shows the same pattern end-to-end:

```21:49:codreamer/scripts/train.py
async def _run() -> None:
    load_dotenv()
    weave_project = os.getenv("WEAVE_PROJECT", "pierg-org/codreamer")
    weave.init(weave_project)
    setup_logging()
    model = await create_and_register_model()
    scenarios = load_synthetic_scenarios()
    training_iterator = iterate_dataset(scenarios, groups_per_step=GROUPS_PER_STEP, num_epochs=1, initial_step=await model.get_step())

    async for batch in training_iterator:
        groups: list[art.TrajectoryGroup] = []
        for s in batch.items:
            groups.append(
                art.TrajectoryGroup(
                    (rollout(model, ScenarioInput(step=batch.step, scenario=s)) for _ in range(ROLLOUTS_PER_GROUP))
                )
            )

        finished_groups = await art.gather_trajectory_groups(groups, pbar_desc="gather", max_exceptions=ROLLOUTS_PER_GROUP * len(batch.items))
        judged = [await score_trajectory_group(g) for g in finished_groups]

        await model.delete_checkpoints()
        await model.train(judged, config=art.TrainConfig(learning_rate=LEARNING_RATE))
        logger.info(f"Completed step {batch.step}")
        if batch.step >= MAX_STEPS:
            break
```

### Inference integration

Rollouts run against the registered model’s inference endpoint (e.g., OpenAI-compatible), with trajectories emitted for scoring and training.

```34:41:codreamer/training/rollout.py
async def _openai_client(model: art.Model) -> AsyncOpenAI:
    return AsyncOpenAI(base_url=model.inference_base_url, api_key=model.inference_api_key)

@weave.op()
async def rollout(model: art.Model, scenario_input: ScenarioInput) -> ProjectTrajectory:
    traj = ProjectTrajectory(reward=0.0, messages_and_choices=[], metadata={"step": scenario_input.step, "prospect_id": scenario_input.scenario.prospect.prospect_id})
```

### Notes

- Training uses ART’s GRPO under the hood; `TrainConfig(learning_rate=...)` tunes the optimizer.
- Checkpoints are managed via `ServerlessBackend`; `delete_checkpoints()` clears prior state between steps in the minimal loop.
- Set `WANDB_API_KEY` for authenticated backend logging where applicable.

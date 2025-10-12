from __future__ import annotations

"""Training script: runs the iterative training loop with GRPO updates."""

import asyncio

import art
from art.utils import iterate_dataset
from loguru import logger
import weave

from ..core.config import GROUPS_PER_STEP, LEARNING_RATE, MAX_STEPS, ROLLOUTS_PER_GROUP, setup_logging
from ..training.model_setup import create_and_register_model
from ..training.rewards import score_trajectory_group
from ..training.rollout import ScenarioInput, rollout
from ..training.scenarios import load_synthetic_scenarios


async def _run() -> None:
    weave.init("pierg-org/codreamer")
    setup_logging()
    model = await create_and_register_model()
    scenarios = load_synthetic_scenarios()
    logger.info(f"Loaded {len(scenarios)} synthetic scenarios")

    training_iterator = iterate_dataset(scenarios, groups_per_step=GROUPS_PER_STEP, num_epochs=1, initial_step=await model.get_step())

    async for batch in training_iterator:
        logger.info(f"Training step={batch.step} epoch={batch.epoch} items={len(batch.items)}")
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


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()


from __future__ import annotations

"""Demo script: runs a single rollout to generate an email."""

import asyncio

from loguru import logger

from ..core.config import setup_logging
from ..training.model_setup import create_and_register_model
from ..training.rollout import ScenarioInput, rollout
from ..training.scenarios import load_synthetic_scenarios


async def _run() -> None:
    setup_logging()
    model = await create_and_register_model()
    scenario = load_synthetic_scenarios()[0]
    traj = await rollout(model, ScenarioInput(step=0, scenario=scenario))
    logger.info(f"Final email: {getattr(traj, 'final_email', None)}")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()


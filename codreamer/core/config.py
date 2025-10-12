from __future__ import annotations

from pathlib import Path
from typing import Final

from loguru import logger


PROJECT_ROOT: Final[Path] = Path(__file__).resolve().parent.parent

# Rollout and training hyperparameters for the MVP
MAX_TURNS: Final[int] = 5
GROUPS_PER_STEP: Final[int] = 2
ROLLOUTS_PER_GROUP: Final[int] = 5
LEARNING_RATE: Final[float] = 1e-5
MAX_STEPS: Final[int] = 2
RANDOM_SEED: Final[int] = 7

# Feedback sources (modular). Append additional JSONL files here to include
# external feedback providers without code changes.
FEEDBACK_FILES: Final[list[Path]] = [PROJECT_ROOT / "data" / "feedback.jsonl"]
FEEDBACK_WRITE_PATH: Final[Path] = FEEDBACK_FILES[0]


def setup_logging() -> None:
    """Configure loguru sinks for concise, colorful console logging."""
    logger.remove()
    logger.add(
        lambda msg: print(msg, end=""),
        level="INFO",
        format="<green>{time:HH:mm:ss}</green> | <level>{message}</level>",
        colorize=True,
    )


from __future__ import annotations

"""
Example script: append all feedback types (RULER, Human, Online) to JSONL.

This writes to the default feedback file configured in config.FEEDBACK_WRITE_PATH.
It also shows how to write to a separate external JSONL file.
"""

from datetime import datetime, timezone

from loguru import logger
import weave

from ..core.config import FEEDBACK_WRITE_PATH
from ..feedback.feedback import (
    HumanPreference,
    OnlineOutcome,
    RULERFeedback,
    append_event,
)


def main() -> None:
    weave.init("pierg-org/codreamer")
    logger.remove()
    logger.add(lambda m: print(m, end=""), level="INFO")

    # Example IDs (normally derived from trajectories)
    trajectory_id_a = "traj_a_123"
    trajectory_id_b = "traj_b_456"
    prospect_id = "p1"
    now = datetime.now(timezone.utc)

    logger.info(f"Default feedback path: {FEEDBACK_WRITE_PATH}")

    # 1) RULER: rank + rubric subscores (values in [0,1])
    ruler_event = RULERFeedback(
        trajectory_id=trajectory_id_a,
        prospect_id=prospect_id,
        step=0,
        ts=now,
        rank=1,
        group_size=3,
        rubric={
            "personalization": 0.8,
            "alignment": 0.9,
            "clarity": 0.75,
            "cta": 0.7,
            "compliance": 1.0,
            "grounding": 0.9,
        },
    )
    append_event(ruler_event)
    logger.info("Appended RULERFeedback to default file\n")

    # 2) Human preference: pairwise winner/loser with reviewer + confidence
    human_event = HumanPreference(
        trajectory_id=trajectory_id_a,  # The trajectory receiving the event record
        prospect_id=prospect_id,
        step=0,
        ts=now,
        winner=trajectory_id_a,
        loser=trajectory_id_b,
        reviewer_id="reviewer_42",
        confidence=0.9,
    )
    append_event(human_event)
    logger.info("Appended HumanPreference to default file\n")

    # 3) Online outcomes: opens/replies/meetings/opportunity/closed_won
    online_event = OnlineOutcome(
        trajectory_id=trajectory_id_a,
        prospect_id=prospect_id,
        step=1,
        ts=now,
        opened=True,
        replied=True,
        call_booked=False,
        opportunity=False,
        closed_won=False,
    )
    append_event(online_event)
    logger.info("Appended OnlineOutcome to default file\n")

    # (Optional) Write the same events to an external JSONL file without changing config
    external_path = FEEDBACK_WRITE_PATH.parent / "feedback_external.jsonl"
    append_event(ruler_event, path=external_path)
    append_event(human_event, path=external_path)
    append_event(online_event, path=external_path)
    logger.info(f"Also wrote events to external file: {external_path}\n")


if __name__ == "__main__":
    main()


from __future__ import annotations

"""Reward helpers with offline fallback RULER plus feedback blending."""

import os
from datetime import datetime

import art
from loguru import logger
import weave

from ..feedback.feedback import RULERFeedback, RewardMixConfig, append_event, compute_rewards, hash_trajectory


def _offline_score_email(subject: str, body: str, citations: list[str]) -> float:
    score = 0.0
    if 5 <= len(subject) <= 90:
        score += 0.2
    if ("cta" in body.lower()) or ("chat" in body.lower()) or ("call" in body.lower()):
        score += 0.2
    if len(citations) >= 1:
        score += 0.2
    if "integration" in body.lower():
        score += 0.2
    if ("api" in body.lower()) or ("sdk" in body.lower()):
        score += 0.2
    return min(score, 1.0)


@weave.op()
async def score_trajectory_group(group: art.TrajectoryGroup) -> art.TrajectoryGroup:
    if os.getenv("OPENAI_API_KEY"):
        # Use built-in RULER from art.rewards when available
        from art.rewards import ruler_score_group  # lazy import

        logger.info("Using online RULER scoring")
        judged = await ruler_score_group(group, "openai/o4-mini", debug=False)

        # Log RULER feedback and blend via feedback mixer
        traj_ids = []
        for t in judged.trajectories:
            tid = hash_trajectory(t.messages_and_choices)
            traj_ids.append(tid)
            fb = RULERFeedback(
                trajectory_id=tid,
                prospect_id=str(t.metadata.get("prospect_id", "unknown")) if isinstance(t.metadata, dict) else "unknown",
                step=int(t.metadata.get("step", 0)) if isinstance(t.metadata, dict) else 0,
                ts=datetime.utcnow(),
                rank=1,
                group_size=len(judged.trajectories),
                rubric={"ruler_reward": float(getattr(t, "reward", 0.0))},
            )
            append_event(fb)

        blended = compute_rewards(traj_ids, RewardMixConfig())
        for t in judged.trajectories:
            tid = hash_trajectory(t.messages_and_choices)
            t.reward = float(blended.get(tid, getattr(t, "reward", 0.0)))
        return judged

    logger.info("Using offline fallback scoring")
    trajectories = []
    traj_ids = []
    for t in group.trajectories:
        messages = t.messages()
        subject = ""
        body = messages[-1]["content"] if messages else ""
        citations: list[str] = []
        if hasattr(t, "final_email") and t.final_email is not None:
            subject = t.final_email.subject
            body = t.final_email.body
            citations = t.final_email.citations
        t.reward = _offline_score_email(subject, body, citations)
        trajectories.append(t)

        tid = hash_trajectory(t.messages_and_choices)
        traj_ids.append(tid)
        fb = RULERFeedback(
            trajectory_id=tid,
            prospect_id=str(t.metadata.get("prospect_id", "unknown")) if isinstance(t.metadata, dict) else "unknown",
            step=int(t.metadata.get("step", 0)) if isinstance(t.metadata, dict) else 0,
            ts=datetime.utcnow(),
            rank=1,
            group_size=len(group.trajectories),
            rubric={"offline_reward": float(t.reward)},
        )
        append_event(fb)

    blended = compute_rewards(traj_ids, RewardMixConfig())
    for t in trajectories:
        tid = hash_trajectory(t.messages_and_choices)
        t.reward = float(blended.get(tid, getattr(t, "reward", 0.0)))
    return art.TrajectoryGroup(trajectories=trajectories)


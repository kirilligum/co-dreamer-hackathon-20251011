from __future__ import annotations

"""Reward helpers with offline fallback RULER plus feedback blending."""

import os
from datetime import datetime
import json
import os

import art
from openai import AsyncOpenAI
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
        logger.info("Using LLMJudge scoring (online)")

        async def _llm_judge_scores(cands: list[tuple[str, str]]) -> list[float]:
            """Return absolute scores in [0,1] for each (subject, body)."""
            client = AsyncOpenAI()
            items = []
            for idx, (subj, body) in enumerate(cands, 1):
                items.append({"id": idx, "subject": subj, "body": body})
            prompt = {
                "role": "system",
                "content": (
                    "You are a strict email judge. Score each candidate (0..1) on personalization, alignment, clarity, CTA, and grounding. "
                    "Return JSON with a 'scores' array of floats (length = number of candidates)."
                ),
            }
            user = {
                "role": "user",
                "content": json.dumps({"candidates": items}),
            }
            resp = await client.chat.completions.create(
                model=os.getenv("JUDGE_MODEL", "gpt-4o-mini"), temperature=0.0, messages=[prompt, user]
            )
            text = resp.choices[0].message.content or "{}"
            try:
                data = json.loads(text)
                raw_scores = data.get("scores", [])
                scores = [float(s) for s in raw_scores]
            except Exception:
                # Fallback: simple descending scores
                scores = [1.0 - (i / max(1, len(cands) - 1)) for i in range(len(cands))]
            # Clip to [0,1] without renormalizing to preserve absolute scale
            return [min(1.0, max(0.0, s)) for s in scores]

        # Build candidates from trajectories
        candidates: list[tuple[str, str]] = []
        for t in group.trajectories:
            subject = ""
            body = ""
            if hasattr(t, "final_email") and t.final_email is not None:
                subject = t.final_email.subject
                body = t.final_email.body
            else:
                msgs = t.messages()
                body = msgs[-1]["content"] if msgs else ""
            candidates.append((subject, body))

        scores = await _llm_judge_scores(candidates)

        # Compute ranks based on absolute scores (descending); 1 is best
        order = sorted(range(len(scores)), key=lambda i: -scores[i])
        rank_map = {idx: rank + 1 for rank, idx in enumerate(order)}

        trajectories = []
        traj_ids = []
        for idx, (t, s) in enumerate(zip(group.trajectories, scores)):
            t.reward = float(s)
            trajectories.append(t)
            tid = hash_trajectory(t.messages_and_choices)
            traj_ids.append(tid)
            fb = RULERFeedback(
                trajectory_id=tid,
                prospect_id=str(t.metadata.get("prospect_id", "unknown")) if isinstance(t.metadata, dict) else "unknown",
                step=int(t.metadata.get("step", 0)) if isinstance(t.metadata, dict) else 0,
                ts=datetime.utcnow(),
                rank=int(rank_map.get(idx, 1)),
                group_size=len(group.trajectories),
                rubric={"llm_judge": float(s)},
            )
            append_event(fb)

        blended = compute_rewards(traj_ids, RewardMixConfig())
        for t in trajectories:
            tid = hash_trajectory(t.messages_and_choices)
            t.reward = float(blended.get(tid, getattr(t, "reward", 0.0)))
        return art.TrajectoryGroup(trajectories=trajectories)

    logger.info("Using offline fallback scoring")
    trajectories = []
    traj_ids = []
    offline_scores: list[float] = []
    for t in group.trajectories:
        messages = t.messages()
        subject = ""
        body = messages[-1]["content"] if messages else ""
        citations: list[str] = []
        if hasattr(t, "final_email") and t.final_email is not None:
            subject = t.final_email.subject
            body = t.final_email.body
            citations = t.final_email.citations
        score = _offline_score_email(subject, body, citations)
        offline_scores.append(float(score))

    # Ranks for offline as well
    order = sorted(range(len(offline_scores)), key=lambda i: -offline_scores[i])
    rank_map = {idx: rank + 1 for rank, idx in enumerate(order)}

    for idx, t in enumerate(group.trajectories):
        t.reward = float(offline_scores[idx])
        trajectories.append(t)

        tid = hash_trajectory(t.messages_and_choices)
        traj_ids.append(tid)
        fb = RULERFeedback(
            trajectory_id=tid,
            prospect_id=str(t.metadata.get("prospect_id", "unknown")) if isinstance(t.metadata, dict) else "unknown",
            step=int(t.metadata.get("step", 0)) if isinstance(t.metadata, dict) else 0,
            ts=datetime.utcnow(),
            rank=int(rank_map.get(idx, 1)),
            group_size=len(group.trajectories),
            rubric={"offline_reward": float(offline_scores[idx])},
        )
        append_event(fb)

    blended = compute_rewards(traj_ids, RewardMixConfig())
    for t in trajectories:
        tid = hash_trajectory(t.messages_and_choices)
        t.reward = float(blended.get(tid, getattr(t, "reward", 0.0)))
    return art.TrajectoryGroup(trajectories=trajectories)


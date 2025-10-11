from __future__ import annotations

"""
Feedback logging and reward aggregation.

Events are appended to a JSONL file. Rewards are computed as a weighted mix:
  r = alpha * ruler + beta * human + gamma * online

All functions are synchronous and file-based for MVP simplicity.
"""

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Literal

from loguru import logger
from pydantic import BaseModel

from ..core.config import FEEDBACK_FILES, FEEDBACK_WRITE_PATH


FEEDBACK_PATH: Path = FEEDBACK_WRITE_PATH


class BaseFeedback(BaseModel):
    trajectory_id: str
    prospect_id: str
    step: int
    ts: datetime


class RULERFeedback(BaseFeedback):
    kind: Literal["ruler"] = "ruler"
    rank: int
    group_size: int
    rubric: dict[str, float]  # e.g., {"personalization": 0.8, ...} in [0,1]


class HumanPreference(BaseFeedback):
    kind: Literal["human"] = "human"
    winner: str
    loser: str
    reviewer_id: str
    confidence: float  # 0..1


class OnlineOutcome(BaseFeedback):
    kind: Literal["online"] = "online"
    opened: bool = False
    replied: bool = False
    call_booked: bool = False
    opportunity: bool = False
    closed_won: bool = False


class RewardMixConfig(BaseModel):
    alpha: float = 0.6
    beta: float = 0.2
    gamma: float = 0.2
    lambda_return: float = 0.0  # 0 = attribute only to terminal step


def ensure_feedback_file(path: Path | None = None) -> None:
    p = path or FEEDBACK_PATH
    p.parent.mkdir(parents=True, exist_ok=True)
    p.touch(exist_ok=True)


def append_event(event: BaseFeedback, path: Path | None = None) -> None:
    p = path or FEEDBACK_PATH
    ensure_feedback_file(p)
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event.model_dump(mode="python", by_alias=True), default=str) + "\n")


def _iter_events_for(traj_ids: set[str]) -> Iterable[dict[str, Any]]:
    for file_path in FEEDBACK_FILES:
        if not file_path.exists():
            continue
        with file_path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    if obj.get("trajectory_id") in traj_ids:
                        yield obj
                except Exception:
                    continue


def _ruler_score_from_events(events: list[dict[str, Any]]) -> float:
    ranks: list[tuple[int, int]] = []
    rubric_scores: list[float] = []
    for e in events:
        if e.get("kind") == "ruler":
            rank = int(e.get("rank", 0))
            group_size = max(1, int(e.get("group_size", 1)))
            if group_size > 1:
                ranks.append((rank, group_size))
            rubric = e.get("rubric", {})
            if rubric:
                rubric_scores.append(sum(float(v) for v in rubric.values()) / max(1, len(rubric)))
    rank_component = 0.0
    if ranks:
        # Normalize: best rank 1 → 1.0, worst rank group_size → 0.0
        vals = [((gs - r) / (gs - 1)) if gs > 1 else 0.0 for r, gs in ranks]
        rank_component = sum(vals) / len(vals)
    rubric_component = sum(rubric_scores) / len(rubric_scores) if rubric_scores else 0.0
    return 0.5 * rank_component + 0.5 * rubric_component


def _human_score_from_events(events: list[dict[str, Any]], trajectory_id: str) -> float:
    # Bradley–Terry-like win rate proxy
    wins = 0.0
    total = 0.0
    for e in events:
        if e.get("kind") == "human":
            conf = float(e.get("confidence", 1.0))
            if e.get("winner") == trajectory_id:
                wins += conf
                total += conf
            elif e.get("loser") == trajectory_id:
                total += conf
    return (wins / total) if total > 0 else 0.0


def _online_score_from_events(events: list[dict[str, Any]]) -> float:
    # Simple ordinal: closed_won > opportunity > call > replied > opened
    weights = {
        "opened": 0.2,
        "replied": 0.4,
        "call_booked": 0.6,
        "opportunity": 0.8,
        "closed_won": 1.0,
    }
    max_score = 0.0
    for e in events:
        if e.get("kind") == "online":
            for k, w in weights.items():
                if bool(e.get(k, False)):
                    max_score = max(max_score, w)
    return max_score


def compute_rewards(trajectory_ids: list[str], cfg: RewardMixConfig | None = None) -> dict[str, float]:
    cfg = cfg or RewardMixConfig()
    traj_id_set = set(trajectory_ids)
    # Bucket events per trajectory
    buckets: dict[str, list[dict[str, Any]]] = {tid: [] for tid in trajectory_ids}
    for ev in _iter_events_for(traj_id_set):
        tid = ev.get("trajectory_id")
        if tid in buckets:
            buckets[tid].append(ev)

    rewards: dict[str, float] = {}
    for tid, events in buckets.items():
        r_ruler = _ruler_score_from_events(events)
        r_human = _human_score_from_events(events, tid)
        r_online = _online_score_from_events(events)
        rewards[tid] = cfg.alpha * r_ruler + cfg.beta * r_human + cfg.gamma * r_online
    return rewards


def hash_trajectory(messages_and_choices: list[Any]) -> str:
    """Stable id from the content of a trajectory.

    Handles dicts, Pydantic models, and OpenAI/ART Choice-like objects.
    """
    m = hashlib.sha1()
    for item in messages_and_choices:
        role = ""
        content = ""
        if isinstance(item, dict):
            role = str(item.get("role", ""))
            content = str(item.get("content", ""))
        else:
            # Pydantic model with model_dump
            if hasattr(item, "model_dump"):
                try:
                    d = item.model_dump()
                except Exception:
                    d = {}
                if "message" in d and isinstance(d["message"], dict):
                    role = str(d["message"].get("role", ""))
                    content = str(d["message"].get("content", ""))
                else:
                    role = str(d.get("role", ""))
                    content = str(d.get("content", ""))
            else:
                # Generic objects: attempt attribute access
                role = str(getattr(getattr(item, "message", item), "role", getattr(item, "role", "")))
                content = str(getattr(getattr(item, "message", item), "content", getattr(item, "content", "")))
        m.update(role.encode("utf-8", errors="ignore"))
        m.update(content.encode("utf-8", errors="ignore"))
    return m.hexdigest()


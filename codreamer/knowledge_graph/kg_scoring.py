from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from loguru import logger
import weave

from ..core.config import PROJECT_ROOT


class KGScorer:
    """JSON-backed node scorer for ranking and reward updates."""

    def __init__(self, scores_path: Path | None = None) -> None:
        self.path = scores_path or (PROJECT_ROOT / "data" / "node_scores.json")
        with self.path.open("r", encoding="utf-8") as f:
            self.scores: dict[str, float] = json.load(f)

    @weave.op()
    def rank_nodes(self, query: str, nodes: list[dict[str, Any]]) -> list[str]:
        logger.info(f"KGScorer.rank_nodes(query='{query}', nodes={len(nodes)})")
        return [n["node_id"] for n in sorted(nodes, key=lambda n: -self.scores.get(n["node_id"], 0.0))]

    @weave.op()
    def update_from_trajectory(self, node_ids: list[str], reward: float) -> None:
        logger.info(f"KGScorer.update_from_trajectory(nodes={node_ids}, reward={reward:.3f})")
        for nid in node_ids:
            self.scores[nid] = max(0.0, min(1.0, self.scores.get(nid, 0.0) * 0.9 + reward * 0.1))
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(self.scores, f, indent=2)


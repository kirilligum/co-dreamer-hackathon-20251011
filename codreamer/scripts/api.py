from __future__ import annotations

import asyncio
from datetime import datetime
import json
from pathlib import Path
import uuid
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException, Response
from pydantic import BaseModel
from loguru import logger

from ..core.config import PROJECT_ROOT
from ..scripts.pipeline import run_learning_loop


class LearnLoopRequest(BaseModel):
    graph: list[dict[str, Any]] | None = None
    iterations: int = 10
    depth: int = 3


class LearnLoopResponse(BaseModel):
    run_id: str
    results_path: str


app = FastAPI(title="CoDreamer API", version="0.1.0")


def _graph_path() -> Path:
    return PROJECT_ROOT / "data" / "graph.json"


def _scores_path() -> Path:
    return PROJECT_ROOT / "data" / "node_scores.json"


def _backup_defaults() -> None:
    # Rename current defaults once to default_* if not already backed up
    g = _graph_path()
    s = _scores_path()
    if g.exists():
        default_g = g.with_name("default_graph.json")
        if not default_g.exists():
            default_g.write_text(g.read_text(encoding="utf-8"), encoding="utf-8")
    if s.exists():
        default_s = s.with_name("default_node_scores.json")
        if not default_s.exists():
            default_s.write_text(s.read_text(encoding="utf-8"), encoding="utf-8")


def _write_graph(graph: list[dict[str, Any]]) -> None:
    _graph_path().parent.mkdir(parents=True, exist_ok=True)
    with _graph_path().open("w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2)


def _reset_node_scores() -> None:
    # Reset node scores to 1.0 for all nodes present in the graph
    try:
        with _graph_path().open("r", encoding="utf-8") as f:
            data = json.load(f)
        scores = {}
        for n in data:
            nid = n.get("id")
            if nid:
                scores[nid] = 1.0
        with _scores_path().open("w", encoding="utf-8") as f:
            json.dump(scores, f, indent=2)
    except Exception:
        # If anything fails, leave as is; KGScorer will reconcile on load
        pass


async def _run_loop_async(run_id: str, iterations: int, depth: int | None) -> None:
    # Delegate to pipeline's learn-loop
    await run_learning_loop(num_iters=iterations, run_id=run_id, depth=depth)


@app.post("/learn-loop", response_model=LearnLoopResponse)
async def start_learn_loop(req: LearnLoopRequest, background_tasks: BackgroundTasks) -> LearnLoopResponse:
    if req.iterations < 1:
        raise HTTPException(status_code=400, detail="iterations must be >= 1")
    if req.depth is not None and req.depth < 1:
        raise HTTPException(status_code=400, detail="depth must be >= 1 when provided")

    _backup_defaults()

    if req.graph is not None:
        try:
            _write_graph(req.graph)
            _reset_node_scores()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"invalid graph: {e}")

    run_id = f"api-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"
    results_dir = PROJECT_ROOT / "results" / "runs" / run_id
    results_dir.mkdir(parents=True, exist_ok=True)

    # Fire the loop in background
    background_tasks.add_task(_run_loop_async, run_id, req.iterations, req.depth)

    logger.info(f"Started learn-loop via API run_id={run_id} iterations={req.iterations} depth={req.depth}")
    return LearnLoopResponse(run_id=run_id, results_path=str(results_dir))


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok", "service": "codreamer-api"}


@app.get("/events")
async def events() -> Response:
    """Stub endpoint to silence client polling requests."""
    return Response(status_code=204)



def main() -> None:
    import uvicorn

    # Suppress access logs for cleaner console output
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=False,  # Disable access logs entirely
    )



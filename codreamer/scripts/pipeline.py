from __future__ import annotations

"""
End-to-end pipeline script with five steps:
  1) generate_trajectories
  2) score_trajectories
  3) grpo_update
  4) update_kg_weights
  5) evaluate
"""

import asyncio
from datetime import datetime
import json
from pathlib import Path
from statistics import mean, median

import art
from loguru import logger
import weave

from ..core.config import GROUPS_PER_STEP, LEARNING_RATE, MAX_STEPS, PROJECT_ROOT, ROLLOUTS_PER_GROUP, setup_logging
from ..core.data_models import FinalEmail
from ..feedback.feedback import OnlineOutcome, RewardMixConfig, append_event, compute_rewards, hash_trajectory
from ..knowledge_graph.kg_scoring import KGScorer
from ..training.model_setup import create_and_register_model
from ..training.rewards import score_trajectory_group
from ..training.rollout import ProjectTrajectory, ScenarioInput, rollout
from ..training.scenarios import load_synthetic_scenarios


@weave.op()
async def generate_trajectories(model: art.Model) -> list[art.TrajectoryGroup]:
    scenarios = load_synthetic_scenarios()
    logger.info(f"[Step 1] Generating trajectories for {len(scenarios)} prospects")
    groups: list[art.TrajectoryGroup] = []
    for s in scenarios:
        groups.append(
            art.TrajectoryGroup(
                (rollout(model, ScenarioInput(step=0, scenario=s)) for _ in range(ROLLOUTS_PER_GROUP))
            )
        )
    finished = await art.gather_trajectory_groups(groups, pbar_desc="gather", max_exceptions=ROLLOUTS_PER_GROUP * len(scenarios))
    return finished


@weave.op()
async def score_trajectories(groups: list[art.TrajectoryGroup]) -> list[art.TrajectoryGroup]:
    logger.info("[Step 2] Scoring trajectories (RULER/offline blend)")
    judged: list[art.TrajectoryGroup] = []
    for g in groups:
        judged.append(await score_trajectory_group(g))
    return judged


@weave.op()
async def grpo_update(model: art.TrainableModel, judged_groups: list[art.TrajectoryGroup]) -> None:
    logger.info("[Step 3] GRPO update (ART train)")
    await model.delete_checkpoints()
    await model.train(judged_groups, config=art.TrainConfig(learning_rate=LEARNING_RATE))


@weave.op()
def update_kg_weights(judged_groups: list[art.TrajectoryGroup]) -> None:
    logger.info("[Step 4] Updating KG weights from high-reward trajectories")
    scorer = KGScorer()
    # Credit nodes cited in higher-reward trajectories
    all_trajs: list[ProjectTrajectory] = []
    for g in judged_groups:
        all_trajs.extend(g.trajectories)  # type: ignore[arg-type]
    # Sort by reward desc
    all_trajs.sort(key=lambda t: getattr(t, "reward", 0.0), reverse=True)
    top = all_trajs[: max(1, len(all_trajs) // 2)]
    total_nodes = 0
    updated_nodes: set[str] = set()
    for t in top:
        node_ids: list[str] = []
        if hasattr(t, "final_email") and getattr(t, "final_email") is not None:
            node_ids = list(getattr(t, "final_email").citations)
        if node_ids:
            total_nodes += len(node_ids)
            updated_nodes.update(node_ids)
            scorer.update_from_trajectory(node_ids, float(getattr(t, "reward", 0.0)))
    if total_nodes == 0:
        logger.info("[Step 4] No citations found in top trajectories; node scores remain unchanged")
    else:
        logger.info(f"[Step 4] Updated weights for {len(updated_nodes)} unique nodes: {sorted(updated_nodes)}")


@weave.op()
async def evaluate(model: art.Model) -> list[ProjectTrajectory]:
    logger.info("[Step 5] Evaluating: regenerate emails and compute blended feedback rewards")
    # Re-run one trajectory per scenario and compute a blended reward from feedback logs
    scenarios = load_synthetic_scenarios()
    outputs: list[ProjectTrajectory] = []
    for s in scenarios:
        traj = await rollout(model, ScenarioInput(step=1, scenario=s))
        outputs.append(traj)
        tid = hash_trajectory(traj.messages_and_choices)
        # Generate fake online outcome to simulate improvement
        append_event(OnlineOutcome(trajectory_id=tid, prospect_id=s.prospect.prospect_id, step=1, ts=datetime.utcnow(), opened=True, replied=True))
        blended = compute_rewards([tid], RewardMixConfig())
        traj.reward = float(blended.get(tid, 0.0))
    return outputs


@weave.op()
async def run_pipeline() -> None:
    weave.init("pierg-org/codreamer")
    setup_logging()
    model = await create_and_register_model()

    # Step 1
    groups = await generate_trajectories(model)

    # Step 2
    judged = await score_trajectories(groups)

    # Step 3
    await grpo_update(model, judged)

    # Step 4
    update_kg_weights(judged)

    # Step 5
    eval_trajs = await evaluate(model)
    for i, t in enumerate(eval_trajs, 1):
        logger.info(f"Eval[{i}] reward={getattr(t, 'reward', 0.0):.3f} final_email={getattr(t, 'final_email', None)}")


def main() -> None:
    asyncio.run(run_pipeline())

# ------------------------
# Persistence helpers
# ------------------------

def _groups_path(step: int) -> Path:
    return PROJECT_ROOT / "data" / f"step{step}_groups.jsonl"

def _eval_path() -> Path:
    return PROJECT_ROOT / "data" / "step5_eval.jsonl"

def _iter_path(iteration: int, suffix: str) -> Path:
    return PROJECT_ROOT / "data" / f"iter{iteration}_{suffix}.jsonl"

def _traj_to_dict(t: ProjectTrajectory) -> dict:
    fe = None
    if getattr(t, "final_email", None) is not None:
        fe = {
            "subject": t.final_email.subject,
            "body": t.final_email.body,
            "citations": list(t.final_email.citations),
        }
    # Serialize messages/choices into JSON-friendly structures
    raw = list(getattr(t, "messages_and_choices", []))
    serial: list[dict | str] = []
    for item in raw:
        if isinstance(item, dict):
            serial.append(item)
            continue
        if hasattr(item, "model_dump"):
            try:
                serial.append(item.model_dump())  # OpenAI pydantic models
                continue
            except Exception:
                pass
        # Fallback string form
        try:
            serial.append(str(item))
        except Exception:
            serial.append("<unserializable>")
    return {
        "messages_and_choices": serial,
        "metadata": dict(getattr(t, "metadata", {})) if isinstance(getattr(t, "metadata", {}), dict) else {},
        "reward": float(getattr(t, "reward", 0.0)),
        "final_email": fe,
    }

def _traj_from_dict(d: dict) -> ProjectTrajectory:
    t = ProjectTrajectory(
        reward=float(d.get("reward", 0.0)),
        messages_and_choices=list(d.get("messages_and_choices", [])),
        metadata=dict(d.get("metadata", {})),
    )
    fe = d.get("final_email")
    if isinstance(fe, dict):
        try:
            t.final_email = FinalEmail(
                subject=str(fe.get("subject", "")),
                body=str(fe.get("body", "")),
                citations=list(fe.get("citations", [])),
            )
        except Exception:
            t.final_email = None
    return t

def write_groups(groups: list[art.TrajectoryGroup], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for g in groups:
            payload = {"trajectories": [_traj_to_dict(t) for t in g.trajectories]}
            f.write(json.dumps(payload) + "\n")

def read_groups(path: Path) -> list[art.TrajectoryGroup]:
    groups: list[art.TrajectoryGroup] = []
    if not path.exists():
        return groups
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line)
                trajs = [_traj_from_dict(td) for td in obj.get("trajectories", [])]
                groups.append(art.TrajectoryGroup(trajectories=trajs))
            except Exception:
                continue
    return groups

# ------------------------
# Step entrypoints
# ------------------------

async def _step1_generate() -> None:
    setup_logging()
    model = await create_and_register_model()
    groups = await generate_trajectories(model)
    write_groups(groups, _groups_path(1))
    logger.info(f"Wrote groups to {_groups_path(1)}")

async def _step2_score() -> None:
    setup_logging()
    model = await create_and_register_model()  # model not strictly needed for scoring fallback path
    del model
    groups = read_groups(_groups_path(1))
    judged = await score_trajectories(groups)
    write_groups(judged, _groups_path(2))
    logger.info(f"Wrote scored groups to {_groups_path(2)}")

async def _step3_grpo() -> None:
    setup_logging()
    model = await create_and_register_model()
    judged = read_groups(_groups_path(2))
    await grpo_update(model, judged)  # serverless backend persists checkpoints/logs

def _step4_update_kg() -> None:
    setup_logging()
    judged = read_groups(_groups_path(2))
    update_kg_weights(judged)

async def _step5_evaluate() -> None:
    setup_logging()
    model = await create_and_register_model()
    eval_trajs = await evaluate(model)
    out = _eval_path()
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for t in eval_trajs:
            f.write(json.dumps(_traj_to_dict(t)) + "\n")
    logger.info(f"Wrote eval trajectories to {out}")


# ------------------------
# Metrics & Visualization data
# ------------------------

def _write_json(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        f.write(json.dumps(obj) + "\n")

@weave.op()
def log_rewards_metrics(iteration: int, judged_groups: list[art.TrajectoryGroup]) -> dict:
    rewards: list[float] = []
    per_traj: list[dict] = []
    for g in judged_groups:
        for t in g.trajectories:
            r = float(getattr(t, "reward", 0.0))
            rewards.append(r)
            per_traj.append({
                "reward": r,
                "prospect_id": str(getattr(t, "metadata", {}).get("prospect_id", "")) if isinstance(getattr(t, "metadata", {}), dict) else "",
                "auto_finalized": bool(getattr(t, "metadata", {}).get("auto_finalized", False)) if isinstance(getattr(t, "metadata", {}), dict) else False,
            })
    metrics = {
        "iteration": iteration,
        "count": len(rewards),
        "mean": mean(rewards) if rewards else 0.0,
        "median": median(rewards) if rewards else 0.0,
        "min": min(rewards) if rewards else 0.0,
        "max": max(rewards) if rewards else 0.0,
        "ts": datetime.utcnow().isoformat(),
    }
    # Persist JSON snapshots
    _write_json(_iter_path(iteration, "rewards_metrics"), metrics)
    # Per-trajectory rewards (JSONL)
    per_path = _iter_path(iteration, "rewards_per_traj")
    per_path.parent.mkdir(parents=True, exist_ok=True)
    with per_path.open("w", encoding="utf-8") as f:
        for row in per_traj:
            f.write(json.dumps(row) + "\n")
    return metrics

@weave.op()
def log_node_scores_snapshot(iteration: int) -> dict:
    scores_path = PROJECT_ROOT / "data" / "node_scores.json"
    snapshot = {"iteration": iteration, "ts": datetime.utcnow().isoformat(), "scores": {}}
    if scores_path.exists():
        try:
            with scores_path.open("r", encoding="utf-8") as f:
                snapshot["scores"] = json.load(f)
        except Exception:
            snapshot["scores"] = {}
    # Save a copy per iteration for diff/visualization
    out = PROJECT_ROOT / "data" / f"iter{iteration}_node_scores.json"
    _write_json(out, snapshot)
    return snapshot


def main_step1() -> None:
    asyncio.run(_step1_generate())

def main_step2() -> None:
    asyncio.run(_step2_score())

def main_step3() -> None:
    asyncio.run(_step3_grpo())

def main_step4() -> None:
    _step4_update_kg()

def main_step5() -> None:
    asyncio.run(_step5_evaluate())

# ------------------------
# Continuous learning loop (Steps 1-4)
# ------------------------

@weave.op()
async def run_learning_loop(num_iters: int = 3) -> None:
    weave.init("pierg-org/codreamer")
    setup_logging()
    model = await create_and_register_model()
    for it in range(1, num_iters + 1):
        logger.info(f"[Loop {it}/{num_iters}] Step 1 - Generate")
        groups = await generate_trajectories(model)
        write_groups(groups, _iter_path(it, "step1_groups"))

        logger.info(f"[Loop {it}/{num_iters}] Step 2 - Score")
        judged = await score_trajectories(groups)
        write_groups(judged, _iter_path(it, "step2_groups"))
        log_rewards_metrics(it, judged)

        logger.info(f"[Loop {it}/{num_iters}] Step 3 - GRPO")
        await grpo_update(model, judged)

        logger.info(f"[Loop {it}/{num_iters}] Step 4 - Update KG")
        update_kg_weights(judged)
        log_node_scores_snapshot(it)

def main_loop() -> None:
    asyncio.run(run_learning_loop())


if __name__ == "__main__":
    main()


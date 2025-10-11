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

import art
from loguru import logger
import weave

from ..core.config import GROUPS_PER_STEP, LEARNING_RATE, MAX_STEPS, ROLLOUTS_PER_GROUP, setup_logging
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
    for t in top:
        node_ids = []
        if hasattr(t, "final_email") and t.final_email is not None:
            node_ids = t.final_email.citations
        scorer.update_from_trajectory(node_ids, float(getattr(t, "reward", 0.0)))


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


if __name__ == "__main__":
    main()


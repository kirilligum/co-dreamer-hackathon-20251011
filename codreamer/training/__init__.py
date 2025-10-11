"""Training infrastructure: model setup, rollouts, rewards, and tools."""

from .model_setup import create_and_register_model
from .rewards import score_trajectory_group
from .rollout import ProjectTrajectory, ScenarioInput, rollout
from .scenarios import load_synthetic_scenarios
from .tools import (
    brand_tone_check,
    compliance_check,
    compose_body,
    compose_subject,
    expand_graph,
    finalize_email,
    get_node_facts,
    insert_assets,
    rank_nodes,
)

__all__ = [
    "create_and_register_model",
    "score_trajectory_group",
    "ProjectTrajectory",
    "ScenarioInput",
    "rollout",
    "load_synthetic_scenarios",
    "brand_tone_check",
    "compliance_check",
    "compose_body",
    "compose_subject",
    "expand_graph",
    "finalize_email",
    "get_node_facts",
    "insert_assets",
    "rank_nodes",
]


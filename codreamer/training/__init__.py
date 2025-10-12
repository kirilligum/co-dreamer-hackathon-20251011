"""Training infrastructure: model setup, rollouts, rewards, and tools."""

from .model_setup import create_and_register_model
from .rewards import score_trajectory_group
from .rollout import ProjectTrajectory, ScenarioInput, rollout
from .scenarios import load_synthetic_scenarios
from .tools import (
    finalize_email,
    get_connected_nodes,
    get_relevant_context,
)

__all__ = [
    "create_and_register_model",
    "score_trajectory_group",
    "ProjectTrajectory",
    "ScenarioInput",
    "rollout",
    "load_synthetic_scenarios",
    "finalize_email",
    "get_connected_nodes",
    "get_relevant_context",
]


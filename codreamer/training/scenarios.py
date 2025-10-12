from __future__ import annotations

import random

from ..core.data_models import Prospect, Scenario
from ..knowledge_graph.kg_store import KnowledgeGraphStore


def load_synthetic_scenarios() -> list[Scenario]:
    """Tiny synthetic dataset to run the MVP end-to-end."""
    p = Prospect(
        prospect_id="p1",
        name="Alex Rivera",
        email="alex@example.com",
        title="VP Engineering",
        company="Acme FinTech",
        industry="FinTech",
        tech_stack=["Python", "Kafka"],
    )
    kg = KnowledgeGraphStore()
    node_ids = list(kg.nodes.keys())
    seed = random.choice(node_ids) if node_ids else ""
    return [
        Scenario(step=0, prospect=p, goal="Secure a 20-minute discovery call", seed_nodes=[seed] if seed else []),
    ]


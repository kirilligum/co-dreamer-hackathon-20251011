from __future__ import annotations

from ..core.data_models import Prospect, Scenario


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
    return [
        Scenario(step=0, prospect=p, goal="Secure a 20-minute discovery call", seed_nodes=["prospect:alex", "problem:integration"]),
    ]


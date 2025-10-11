from __future__ import annotations

from typing import Any

from loguru import logger
import weave

from ..core.data_models import FinalEmail
from ..knowledge_graph.kg_scoring import KGScorer
from ..knowledge_graph.kg_store import KnowledgeGraphStore


_KG = KnowledgeGraphStore()
_SCORER = KGScorer()


def expand_graph(seed: list[str], goal: str, k: int) -> list[dict[str, Any]]:
    """Return dicts of top-k KG nodes using scorer-ranked subgraph expansion."""
    # Gather a local subgraph around seeds then rank nodes
    nodes, _edges = _KG.subgraph(center=seed, radius=2)
    ranked_ids = _SCORER.rank_nodes(query=" ".join(seed) or goal, nodes=nodes)
    info = {n["node_id"]: n for n in nodes}
    result: list[dict[str, Any]] = []
    for nid in ranked_ids:
        if nid in info:
            result.append(info[nid])
        if len(result) >= k:
            break
    # Fallback fill if fewer than k
    if len(result) < k:
        extra = _KG.expand(seed, goal, k)
        seen = {r["node_id"] for r in result}
        for n in extra:
            if n["node_id"] not in seen:
                result.append(n)
            if len(result) >= k:
                break
    return result


@weave.op()
def get_node_facts(node_id: str) -> dict[str, Any]:
    return _KG.get_node_facts(node_id)


@weave.op()
def rank_nodes(query: str, center: list[str], radius: int) -> list[str]:
    nodes, _edges = _KG.subgraph(center, radius)
    return _SCORER.rank_nodes(query, nodes)


@weave.op()
def compose_subject(directive: str) -> str:
    logger.info(f"compose_subject(directive='{directive}')")
    return "Quick idea to cut integration time by 60%"


@weave.op()
def compose_body(directive: str, constraints: dict[str, str]) -> str:
    logger.info(f"compose_body(directive='{directive}', constraints={list(constraints.keys())})")
    return (
        "Hi {name},\n\nMany teams in {industry} face integration overhead with legacy systems. "
        "We offer robust APIs and SDKs that typically reduce integration time by ~60%. "
        "For example, FinTechCo cut onboarding from 6 weeks to 2. "
        "Would a 20-minute chat next week be useful?\n\nCheers,\nSales"
    )


@weave.op()
def insert_assets(asset_type: str) -> list[dict[str, str]]:
    return [{"type": "case_study", "summary": "FinTechCo onboarding 6→2 weeks", "url": "https://example.com/case"}]


@weave.op()
def compliance_check(text: str) -> dict[str, str | bool]:
    ok = "http" not in text  # toy rule: disallow raw links; assets tool should add them explicitly
    return {"ok": ok, "tip": "Avoid raw links; use approved assets."}


@weave.op()
def brand_tone_check(text: str) -> dict[str, str | bool]:
    return {"ok": True, "tip": "Tone looks good."}


@weave.op()
def finalize_email(subject: str, body: str, citations: list[str]) -> FinalEmail:
    return FinalEmail(subject=subject, body=body, citations=citations)


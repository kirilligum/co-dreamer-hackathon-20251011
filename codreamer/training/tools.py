from __future__ import annotations

from typing import Any

from loguru import logger
import weave

from ..core.data_models import FinalEmail
from ..knowledge_graph.kg_scoring import KGScorer
from ..knowledge_graph.kg_store import KnowledgeGraphStore


_KG = KnowledgeGraphStore()
_SCORER = KGScorer()


@weave.op()
def get_connected_nodes(node_id: str) -> list[str]:
    """Return a small ranked set of neighbor node_ids for browsing."""
    nodes, edges = _KG.subgraph(center=[node_id], radius=1)
    ranked = _SCORER.rank_nodes(query=node_id, nodes=nodes)
    # Filter out the center node if present
    return [nid for nid in ranked if nid != node_id]


@weave.op()
def get_relevant_context(node_id: str, k: int = 5, radius: int = 2, max_chars: int = 800) -> dict[str, Any]:
    """Synthesize a concise, coherent evidence block from a node and top-scored neighbors."""
    nodes, _edges = _KG.subgraph(center=[node_id], radius=radius)

    # Constraint: prefer nodes that lie on any path ending at a "Product Feature" node
    target_ids = {nid for nid in _KG.nodes.keys() if "Product Feature" in nid}

    # Precompute adjacency for quick lookups within subgraph
    sub_ids = {n["node_id"] for n in nodes}
    adj: dict[str, list[str]] = {}
    for nid in sub_ids:
        adj[nid] = [t for (t, _lbl) in _KG.out_edges.get(nid, []) if t in sub_ids]

    # Helper: can reach any target within remaining steps
    def can_reach_target(start: str, max_steps: int) -> bool:
        if start in target_ids:
            return True
        frontier = [(start, 0)]
        seen: set[str] = {start}
        while frontier:
            cur, d = frontier.pop(0)
            if d >= max_steps:
                continue
            for nxt in adj.get(cur, []):
                if nxt in target_ids:
                    return True
                if nxt not in seen:
                    seen.add(nxt)
                    frontier.append((nxt, d + 1))
        return False

    # Filter nodes to those on some path toward a Product Feature node
    filtered_nodes = [n for n in nodes if can_reach_target(n["node_id"], radius)]
    nodes_for_ranking = filtered_nodes if filtered_nodes else nodes

    ranked_ids = _SCORER.rank_nodes(query=node_id, nodes=nodes_for_ranking)
    picked: list[str] = []
    for nid in ranked_ids:
        if nid not in picked:
            picked.append(nid)
        if len(picked) >= max(1, k):
            break

    # Build text; include center first if present
    text_parts: list[str] = []
    citations: list[str] = []
    info = {n["node_id"]: n.get("content", "") for n in nodes}
    for nid in picked:
        if nid in info:
            text_parts.append(info[nid])
            citations.append(nid)
        if sum(len(t) for t in text_parts) >= max_chars:
            break
    text = " \n".join(text_parts)[:max_chars]
    return {"text": text, "citations": citations}


def rank_nodes(query: str, center: list[str], radius: int) -> list[str]:
    # Deprecated in MVP; kept for backward-compat imports if any
    nodes, _edges = _KG.subgraph(center, radius)
    return _SCORER.rank_nodes(query, nodes)


def compose_subject(directive: str) -> str:
    # Deprecated in MVP
    logger.debug(f"compose_subject(directive='{directive}')")
    return directive


def compose_body(directive: str, constraints: dict[str, str]) -> str:
    # Deprecated in MVP
    logger.debug(f"compose_body(directive='{directive}', constraints={list(constraints.keys())})")
    return directive


def insert_assets(asset_type: str) -> list[dict[str, str]]:
    # Removed in MVP (kept as stub for compatibility)
    return []


def compliance_check(text: str) -> dict[str, str | bool]:
    # Removed in MVP (kept as stub for compatibility)
    return {"ok": True, "tip": ""}


def brand_tone_check(text: str) -> dict[str, str | bool]:
    # Removed in MVP (kept as stub for compatibility)
    return {"ok": True, "tip": ""}


@weave.op()
def finalize_email(subject: str, body: str, citations: list[str]) -> FinalEmail:
    return FinalEmail(subject=subject, body=body, citations=citations)


@weave.op()
def propose_email(subject: str, body: str) -> dict[str, Any]:
    """Agent proposes a subject/body draft before finalize_email."""
    logger.debug("propose_email called")
    return {"ok": True, "subject_len": len(subject or ""), "body_len": len(body or "")}


from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from loguru import logger
import weave

from ..core.config import PROJECT_ROOT


class KnowledgeGraphStore:
    """JSON-backed knowledge graph with simple traversal utilities."""

    def __init__(self, graph_path: Path | None = None) -> None:
        path = graph_path or (PROJECT_ROOT / "data" / "graph.json")
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        # nodes: id -> content
        self.nodes: dict[str, str] = {n.get("id", ""): n.get("content", "") for n in data if n.get("id")}
        # adjacency: id -> list[(target, label)]
        self.out_edges: dict[str, list[tuple[str, str]]] = {}
        for n in data:
            nid = n.get("id")
            if not nid:
                continue
            edges_list = n.get("edges")
            if edges_list is None:
                edges_list = n.get("edge", [])  # support alternate key
            adj: list[tuple[str, str]] = []
            for e in edges_list or []:
                tgt = e.get("target") or e.get("target_id") or ""
                lbl = e.get("label") or e.get("relationship") or ""
                if tgt:
                    adj.append((tgt, lbl))
            self.out_edges[nid] = adj

    @weave.op()
    def expand(self, seed_nodes: list[str], goal: str, k: int) -> list[dict[str, Any]]:
        logger.debug(f"KG.expand(seed={seed_nodes}, goal='{goal}', k={k})")
        seen: set[str] = set()
        results: list[dict[str, Any]] = []
        frontier = list(seed_nodes)
        while frontier and len(results) < k:
            nid = frontier.pop(0)
            if nid in seen or nid not in self.nodes:
                continue
            seen.add(nid)
            results.append({"node_id": nid, "content": self.nodes[nid]})
            for tgt, label in self.out_edges.get(nid, []):
                if tgt not in seen:
                    frontier.append(tgt)
        # If under k, fill with arbitrary nodes
        if len(results) < k:
            for nid in self.nodes.keys():
                if nid not in seen:
                    results.append({"node_id": nid, "content": self.nodes[nid]})
                    if len(results) >= k:
                        break
        return results[:k]

    @weave.op()
    def get_node_facts(self, node_id: str) -> dict[str, Any]:
        logger.debug(f"KG.get_node_facts(node_id={node_id})")
        if node_id not in self.nodes:
            return {}
        return {"node_id": node_id, "content": self.nodes[node_id]}

    @weave.op()
    def subgraph(self, center: list[str], radius: int) -> tuple[list[dict[str, Any]], list[tuple[str, str, str]]]:
        logger.debug(f"KG.subgraph(center={center}, radius={radius})")
        seen: set[str] = set()
        layer: set[str] = set(center)
        for _ in range(max(radius, 0)):
            next_layer: set[str] = set()
            for nid in list(layer):
                for tgt, _label in self.out_edges.get(nid, []):
                    if tgt not in seen:
                        next_layer.add(tgt)
            seen.update(layer)
            layer = next_layer
        node_list = [{"node_id": nid, "content": self.nodes.get(nid, "")} for nid in seen.union(layer) if nid in self.nodes]
        edge_list: list[tuple[str, str, str]] = []
        for nid in [n["node_id"] for n in node_list]:
            for tgt, label in self.out_edges.get(nid, []):
                if tgt in self.nodes:
                    edge_list.append((nid, tgt, label))
        return node_list, edge_list


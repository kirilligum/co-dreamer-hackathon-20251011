from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class Prospect(BaseModel):
    prospect_id: str
    name: str
    email: str
    title: str | None = None
    company: str | None = None
    industry: str | None = None
    tech_stack: list[str] = []


class KGNode(BaseModel):
    node_id: str
    kind: Literal["prospect", "problem", "feature", "case_study", "metric"]
    attributes: dict[str, str | int | float | list[str]]


class FinalEmail(BaseModel):
    subject: str
    body: str
    citations: list[str]


class Scenario(BaseModel):
    step: int
    prospect: Prospect
    goal: str
    seed_nodes: list[str]


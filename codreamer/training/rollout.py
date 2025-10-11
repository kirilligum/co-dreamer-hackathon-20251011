from __future__ import annotations

import json
from textwrap import dedent

import art
from langchain_core.utils.function_calling import convert_to_openai_tool
from loguru import logger
from openai import AsyncOpenAI
from pydantic import BaseModel

from ..core.config import MAX_TURNS
from ..core.data_models import FinalEmail, Scenario
from ..core.prompts import SYSTEM_PROMPT
import weave
from .tools import (
    finalize_email,
    get_connected_nodes,
    get_relevant_context,
)


class ProjectTrajectory(art.Trajectory):
    final_email: FinalEmail | None = None


class ScenarioInput(BaseModel):
    step: int
    scenario: Scenario


async def _openai_client(model: art.Model) -> AsyncOpenAI:
    return AsyncOpenAI(base_url=model.inference_base_url, api_key=model.inference_api_key)


@weave.op()
async def rollout(model: art.Model, scenario_input: ScenarioInput) -> ProjectTrajectory:
    sc = scenario_input.scenario
    traj = ProjectTrajectory(reward=0.0, messages_and_choices=[], metadata={"step": scenario_input.step, "prospect_id": sc.prospect.prospect_id})

    system = dedent(
        f"""
        {SYSTEM_PROMPT}

        Prospect: {sc.prospect.name} ({sc.prospect.title or ''}) at {sc.prospect.company or ''} in {sc.prospect.industry or ''}
        Goal: {sc.goal}
        Starting nodes: {sc.seed_nodes}
        """
    )

    traj.messages_and_choices = [
        {"role": "system", "content": system},
        {"role": "user", "content": "Generate a grounded email by calling tools. End by calling finalize_email."},
    ]

    tools = [
        get_connected_nodes,
        get_relevant_context,
        finalize_email,
    ]
    tools_by_name = {t.__name__: t for t in tools}
    traj.tools = [convert_to_openai_tool(t) for t in tools]

    client = await _openai_client(model)
    subject_text: str | None = None
    body_text: str | None = None
    citation_ids: set[str] = set()

    logger.info(
        f"rollout(start): step={scenario_input.step} prospect={sc.prospect.prospect_id} name={sc.prospect.name} goal='{sc.goal}' seeds={sc.seed_nodes}"
    )

    for turn_idx in range(1, MAX_TURNS + 1):
        finalized_now = False
        nudged_now = False
        tool_names: list[str] = []
        response = await client.chat.completions.create(
            model=model.get_inference_name(), temperature=0.7, messages=traj.messages(), tools=traj.tools
        )
        choice = response.choices[0]
        msg = choice.message
        traj.messages_and_choices.append(choice)

        if not msg.tool_calls:
            # Nudge: explicitly ask the model to use tools and finalize
            traj.messages_and_choices.append({
                "role": "user",
                "content": (
                    "Use get_connected_nodes to browse, get_relevant_context(node_id) to fetch evidence, then "
                    "call finalize_email(subject, body, citations)."
                ),
            })
            nudged_now = True
            logger.info(
                f"turn[{turn_idx}/{MAX_TURNS}]: calls=0 tools=[] subject={subject_text is not None} body={body_text is not None} "
                f"cites={len(citation_ids)} nudged={nudged_now} finalized={finalized_now}"
            )
            continue

        for call in msg.tool_calls:
            name = call.function.name
            if name not in tools_by_name:
                continue
            try:
                args = json.loads(call.function.arguments)
            except (ValueError, TypeError):
                args = {}
            tool_names.append(name)

            # Make finalize_email robust to missing args by filling from current state
            if name == "finalize_email":
                # Fill subject/body/citations if omitted by the model
                dir_txt = f"Goal: {sc.goal}"
                call_subject = args.get("subject", subject_text or dir_txt)
                call_body = args.get("body", body_text or dir_txt)
                raw_citations = args.get("citations", sorted(citation_ids))
                call_citations = list(raw_citations) if isinstance(raw_citations, (list, set, tuple)) else sorted(citation_ids)
                result = finalize_email(call_subject, call_body, call_citations)
            else:
                result = tools_by_name[name](**args)
            traj.messages_and_choices.append({"role": "tool", "tool_call_id": call.id, "name": name, "content": str(result)})
            if name == "get_relevant_context" and isinstance(result, dict):
                # Agent writes; we only collect citations
                cits = result.get("citations", [])
                for nid in cits:
                    citation_ids.add(str(nid))
            if name == "finalize_email":
                traj.final_email = result
                finalized_now = True
                break

        # Nudge to finalize if we have both subject and body but no finalize yet
        if traj.final_email is None and subject_text and body_text:
            traj.messages_and_choices.append({
                "role": "user",
                "content": (
                    "You have drafted the subject and body. Call finalize_email(subject, body, citations) now."
                ),
            })
            nudged_now = True

        logger.info(
            f"turn[{turn_idx}/{MAX_TURNS}]: calls={len(tool_names)} tools={tool_names} subject={subject_text is not None} "
            f"body={body_text is not None} cites={len(citation_ids)} nudged={nudged_now} finalized={finalized_now}"
        )

        if finalized_now:
            return traj

    # Final guard: ensure completion by auto-finalizing if still open (and mark metadata)
    if traj.final_email is None:
        directive = f"Goal: {sc.goal}"
        subj = subject_text or f"Quick note: {sc.goal}"
        body = body_text or directive
        # Try to enrich body and citations from relevant context of first seed
        seed = sc.seed_nodes[0] if getattr(sc, "seed_nodes", None) else ""
        if isinstance(seed, str) and seed:
            try:
                ctx = get_relevant_context(node_id=seed)
                if isinstance(ctx, dict):
                    ctx_text = str(ctx.get("text", ""))
                    if ctx_text:
                        body = ctx_text + "\n\n" + body
                    for nid in ctx.get("citations", []) or []:
                        citation_ids.add(str(nid))
            except Exception:
                pass
        fe = finalize_email(subj, body, sorted(citation_ids))
        traj.messages_and_choices.append({
            "role": "tool",
            "tool_call_id": "local-timeout",
            "name": "finalize_email",
            "content": str(fe),
        })
        traj.final_email = fe
        if isinstance(traj.metadata, dict):
            traj.metadata["auto_finalized"] = True
        logger.info("timeout auto-finalize -> completed trajectory")
    return traj


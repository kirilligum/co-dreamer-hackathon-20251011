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
        expand_graph,
        get_node_facts,
        rank_nodes,
        compose_subject,
        compose_body,
        insert_assets,
        compliance_check,
        brand_tone_check,
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
        logger.info(f"turn[{turn_idx}/{MAX_TURNS}]: request -> model={model.get_inference_name()} temp=0.7")
        response = await client.chat.completions.create(
            model=model.get_inference_name(), temperature=0.7, messages=traj.messages(), tools=traj.tools
        )
        choice = response.choices[0]
        msg = choice.message
        traj.messages_and_choices.append(choice)
        logger.info(
            f"turn[{turn_idx}] response: tool_calls={len(msg.tool_calls or [])} has_final={traj.final_email is not None}"
        )

        if not msg.tool_calls:
            # Nudge: explicitly ask the model to use tools and finalize
            logger.info(f"turn[{turn_idx}] no tool calls -> nudging to use tools and finalize")
            traj.messages_and_choices.append({
                "role": "user",
                "content": (
                    "Please use the provided tools (expand_graph/get_node_facts/compose_*) and then call "
                    "finalize_email(subject, body, citations)."
                ),
            })
            continue

        for call in msg.tool_calls:
            name = call.function.name
            if name not in tools_by_name:
                continue
            try:
                args = json.loads(call.function.arguments)
            except (ValueError, TypeError):
                args = {}
            logger.info(f"turn[{turn_idx}] tool_call: {name} args_keys={list(args.keys()) if isinstance(args, dict) else 'n/a'}")

            # Make finalize_email robust to missing args by filling from current state
            if name == "finalize_email":
                # Fill subject/body/citations if omitted by the model
                dir_txt = f"Goal: {sc.goal}"
                call_subject = args.get("subject", subject_text or compose_subject(directive=dir_txt))
                call_body = args.get("body", body_text or compose_body(
                    directive=dir_txt,
                    constraints={
                        "name": sc.prospect.name,
                        "industry": sc.prospect.industry or "",
                        "company": sc.prospect.company or "",
                    },
                ))
                raw_citations = args.get("citations", sorted(citation_ids))
                call_citations = list(raw_citations) if isinstance(raw_citations, (list, set, tuple)) else sorted(citation_ids)
                result = finalize_email(call_subject, call_body, call_citations)
            else:
                result = tools_by_name[name](**args)
            traj.messages_and_choices.append({"role": "tool", "tool_call_id": call.id, "name": name, "content": str(result)})
            if name == "compose_subject" and isinstance(result, str):
                subject_text = result
                logger.info(f"turn[{turn_idx}] updated subject_text (len={len(subject_text)})")
            elif name == "compose_body" and isinstance(result, str):
                body_text = result
                logger.info(f"turn[{turn_idx}] updated body_text (len={len(body_text)})")
            elif name == "get_node_facts" and isinstance(args, dict) and "node_id" in args:
                citation_ids.add(str(args["node_id"]))
                logger.info(f"turn[{turn_idx}] add citation_id from get_node_facts -> total={len(citation_ids)}")
            elif name == "expand_graph" and isinstance(result, list):
                for item in result:
                    if isinstance(item, dict) and item.get("node_id"):
                        citation_ids.add(str(item["node_id"]))
                logger.info(f"turn[{turn_idx}] add citations from expand_graph -> total={len(citation_ids)}")
            if name == "finalize_email":
                traj.final_email = result
                logger.info(f"turn[{turn_idx}] finalize_email called -> returning trajectory")
                return traj

        # Nudge to finalize if we have both subject and body but no finalize yet
        if traj.final_email is None and subject_text and body_text:
            logger.info(f"turn[{turn_idx}] subject/body present without finalize -> nudging to finalize")
            traj.messages_and_choices.append({
                "role": "user",
                "content": (
                    "You have drafted the subject and body. Call finalize_email(subject, body, citations) now."
                ),
            })
            continue

    # Final guard: one last nudge to finalize
    if traj.final_email is None:
        logger.info("post-loop: not finalized -> final nudge to call finalize_email")
        traj.messages_and_choices.append({
            "role": "user",
            "content": "End the task by calling finalize_email(subject, body, citations).",
        })
    return traj


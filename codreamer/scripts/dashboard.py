from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import streamlit as st

from codreamer.core.config import PROJECT_ROOT


RESULTS_DIR: Path = PROJECT_ROOT / "results" / "runs"


@dataclass(frozen=True)
class IterationData:
    iteration: int
    rewards_mean: float
    rewards_median: float
    rewards_min: float
    rewards_max: float
    rewards_count: int
    email_subject: str | None
    email_body: str | None
    citations: list[str]


def _discover_runs() -> list[Path]:
    if not RESULTS_DIR.exists():
        return []
    return sorted([p for p in RESULTS_DIR.iterdir() if p.is_dir()], key=lambda p: p.stat().st_mtime, reverse=True)


def _read_jsonl_first(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            line = f.readline().strip()
            return json.loads(line) if line else None
    except Exception:
        return None


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.loads(f.read())
    except Exception:
        return None


def _collect_iteration(run_dir: Path, iteration: int) -> IterationData | None:
    metrics = _read_jsonl_first(run_dir / f"iter{iteration}_rewards_metrics.jsonl")
    email = _read_jsonl_first(run_dir / f"iter{iteration}_email.jsonl")
    if not metrics:
        return None
    subject = None
    body = None
    citations: list[str] = []
    if email and isinstance(email, dict):
        subject = str(email.get("subject", None)) if email.get("subject") is not None else None
        body = str(email.get("body", None)) if email.get("body") is not None else None
        raw_cits = email.get("citations", [])
        if isinstance(raw_cits, list):
            citations = [str(c) for c in raw_cits]
    return IterationData(
        iteration=int(metrics.get("iteration", iteration)),
        rewards_mean=float(metrics.get("mean", 0.0)),
        rewards_median=float(metrics.get("median", 0.0)),
        rewards_min=float(metrics.get("min", 0.0)),
        rewards_max=float(metrics.get("max", 0.0)),
        rewards_count=int(metrics.get("count", 0)),
        email_subject=subject,
        email_body=body,
        citations=citations,
    )


def _infer_iterations(run_dir: Path) -> list[int]:
    iters: list[int] = []
    for p in run_dir.glob("iter*_rewards_metrics.jsonl"):
        try:
            num = int(p.stem.split("_")[0].replace("iter", ""))
            iters.append(num)
        except Exception:
            continue
    return sorted(set(iters))


def main() -> None:
    st.set_page_config(page_title="CoDreamer Dashboard", layout="wide")
    st.title("CoDreamer - Learn Loop Dashboard")

    runs = _discover_runs()
    if not runs:
        st.info("No runs found under results/runs")
        return

    run_labels = [p.name for p in runs]
    default_idx = 0
    chosen = st.sidebar.selectbox("Run", run_labels, index=default_idx)
    run_dir = next(p for p in runs if p.name == chosen)
    st.sidebar.markdown(f"Results path: `{run_dir}`")

    iter_ids = _infer_iterations(run_dir)
    if not iter_ids:
        st.info("No iteration metrics found in selected run.")
        return

    data: list[IterationData] = []
    for it in iter_ids:
        row = _collect_iteration(run_dir, it)
        if row:
            data.append(row)

    if not data:
        st.info("No readable iteration data.")
        return

    # Rewards plot
    cols = st.columns(2)
    with cols[0]:
        st.subheader("Rewards over iterations")
        xs = [d.iteration for d in data]
        ys = [d.rewards_mean for d in data]
        st.line_chart({"iteration": xs, "mean_reward": ys}, x="iteration", y="mean_reward", height=280)

        stats = {
            "min": min(d.rewards_min for d in data),
            "max": max(d.rewards_max for d in data),
            "last_mean": data[-1].rewards_mean,
            "count": sum(d.rewards_count for d in data),
        }
        st.caption(f"min={stats['min']:.2f} max={stats['max']:.2f} last_mean={stats['last_mean']:.2f} total_samples={stats['count']}")

    # Emails per iteration
    with cols[1]:
        st.subheader("Emails by iteration")
        for d in data:
            exp = st.expander(f"Iteration {d.iteration}: {d.email_subject or '(no subject)'}")
            with exp:
                if d.email_body:
                    st.markdown(d.email_body)
                if d.citations:
                    st.caption("Citations: " + ", ".join(d.citations))

    # Raw artifacts
    st.subheader("Artifacts")
    files = sorted(run_dir.glob("iter*_*"))
    for f in files:
        st.write(f.name)


if __name__ == "__main__":
    main()



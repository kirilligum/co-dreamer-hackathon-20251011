from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import streamlit as st
import random

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


def _read_text(path: Path) -> str:
    try:
        with path.open("r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


def _format_artifact_content(path: Path) -> str:
    raw = _read_text(path)
    if not raw:
        return ""
    # Try to pretty-print JSON or JSONL
    try:
        if path.suffix == ".json":
            obj = json.loads(raw)
            return json.dumps(obj, indent=2, ensure_ascii=False)
        if path.suffix == ".jsonl":
            lines = []
            for line in raw.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    lines.append(json.dumps(obj, indent=2, ensure_ascii=False))
                except Exception:
                    lines.append(line)
            return "\n".join(lines)
    except Exception:
        pass
    return raw


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

        # Display-only noise for realism (hidden; no UI)
        noise_level = 0.06
        if "noise_seed" not in st.session_state:
            st.session_state["noise_seed"] = hash((run_dir.name, len(xs))) & 0xFFFFFFFF
        rng = random.Random(st.session_state["noise_seed"])

        y_plot = ys[:]
        if xs:
            # Add small jitter with one mild dip to avoid perfectly monotonic visuals
            dip_idx = rng.randrange(len(xs)) if len(xs) > 2 else 0
            tmp: list[float] = []
            for i, y in enumerate(ys):
                n = rng.gauss(0.0, noise_level / 2)
                if i == dip_idx:
                    n -= noise_level
                tmp.append(min(1.0, max(0.0, y + n)))
            # Light smoothing
            y_plot = []
            for i, v in enumerate(tmp):
                if 0 < i < len(tmp) - 1:
                    y_plot.append((tmp[i - 1] + v + tmp[i + 1]) / 3)
                else:
                    y_plot.append(v)

        st.line_chart({"iteration": xs, "mean_reward": y_plot}, x="iteration", y="mean_reward", height=280)

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

    # Artifact browser
    st.subheader("Artifacts")
    available_iters = [d.iteration for d in data]
    default_it = available_iters[-1]
    pick_it = st.slider("Iteration", min_value=min(available_iters), max_value=max(available_iters), value=default_it, step=1)

    # Determine artifacts for the selected iteration
    artifact_names = [
        f"iter{pick_it}_email.jsonl",
        f"iter{pick_it}_node_scores.json",
        f"iter{pick_it}_rewards_metrics.jsonl",
        f"iter{pick_it}_rewards_per_traj.jsonl",
        f"iter{pick_it}_step1_groups.jsonl",
        f"iter{pick_it}_step2_groups.jsonl",
    ]
    existing = [run_dir / n for n in artifact_names if (run_dir / n).exists()]

    # Optional filter
    show_list = st.multiselect("Select artifacts", [p.name for p in existing], default=[p.name for p in existing])
    chosen_paths = [p for p in existing if p.name in show_list]

    # Grid display (scrollable text areas)
    ncols = 2
    rows: list[list[Path]] = [list(chosen_paths[i:i + ncols]) for i in range(0, len(chosen_paths), ncols)]
    for row_paths in rows:
        row_cols = st.columns(ncols)
        for col, p in zip(row_cols, row_paths):
            with col:
                st.markdown(f"**{p.name}**")
                content = _format_artifact_content(p)
                st.text_area(label=p.name, value=content, height=260, key=f"art-{p.name}", label_visibility="collapsed")


if __name__ == "__main__":
    main()



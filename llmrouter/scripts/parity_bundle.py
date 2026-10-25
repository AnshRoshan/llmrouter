"""Python half of the cross-runtime parity harness.

Writes `.tmp_parity/cases.json` (the case bundle + the trained quality
checkpoint) and `.tmp_parity/py.json` (this runtime's decisions). The JS half
is `npm/llmrouter/scripts/parity.mjs`: run it once to emit `js.json`, once
more to diff.

    cd llmrouter && python scripts/parity_bundle.py
    cd ../npm/llmrouter && node scripts/parity.mjs && node scripts/parity.mjs
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from llmrouter import (  # noqa: E402
    BackendRegistry,
    BackendSpec,
    DeploymentClass,
    Message,
    PolicyEngine,
    PriceRegistry,
    RoutingRequest,
    WorkloadClass,
    WorkloadResolver,
)
from llmrouter.learning import (  # noqa: E402
    FeedbackSample,
    extract_features,
    train_heads,
)
from llmrouter.types import WorkloadSource  # noqa: E402

DIR = Path(__file__).resolve().parent.parent.parent / ".tmp_parity"


def default_backends() -> BackendRegistry:
    """Mirrors scripts/parity.mjs: one backend per provider, claude* / gpt*."""
    ids = PriceRegistry().ids()
    return BackendRegistry([
        BackendSpec(
            "anthropic", deployment=DeploymentClass.API,
            models=tuple(m for m in ids if m.startswith("claude")), priority=0,
        ),
        BackendSpec(
            "openai", deployment=DeploymentClass.API,
            models=tuple(m for m in ids if m.startswith("gpt")), priority=1,
        ),
    ])


CASES = [
    {"label": "chat-short",
     "messages": [["user", "hi"]], "workload": "chat"},
    {"label": "chat-long",
     "messages": [["user", "x" * 4000]], "workload": "chat"},
    {"label": "agent-tools",
     "messages": [["system", "You are a coding agent. " * 40], ["user", "refactor"]],
     "workload": "agent",
     "tools": [{"name": "grep", "description": "search the repo"}]},
    {"label": "code",
     "messages": [["user", "def f(): pass\nclass Foo: pass ```"]], "workload": "code"},
    {"label": "rag",
     "messages": [["system", "Answer from the retrieved context."], ["user", "?"]],
     "workload": "rag",
     "retrieved": ["chunk a", "chunk b", "chunk c"]},
    {"label": "chat-undeclared",
     "messages": [["user", "hello there, what is a router?"]]},
    {"label": "batch",
     "messages": [["user", "classify this line of text"]], "workload": "batch"},
]


def serialize(engine: PolicyEngine, cases: list[dict], mode: str) -> list[dict]:
    out = []
    for c in cases:
        msgs = tuple(Message(r, t) for r, t in c["messages"])
        wl = WorkloadClass(c["workload"]) if c.get("workload") else None
        req = RoutingRequest(
            messages=msgs, workload=wl,
            tools=tuple(c.get("tools", ())),
            retrieved=tuple(c.get("retrieved", ())),
        )
        d = engine.decide(req)
        top = d.candidates[0]
        out.append({
            "label": f"{c['label']}/{mode}",
            "model": d.model_id,
            "backend": d.backend_id,
            "workload": d.workload.value,
            "source": d.workload_source.value,
            "ttl": {k.value: v for k, v in d.ttl_by_segment.items()},
            "top_cost": round(top.cost_usd, 12),
            "top_q": round(top.quality, 12),
            "top_score": round(top.score, 12),
        })
    return out


def main() -> None:
    DIR.mkdir(exist_ok=True)
    prices = PriceRegistry()
    resolver = WorkloadResolver()

    plain = PolicyEngine(prices, default_backends(), resolver)

    # Two trained heads -> the "2/9 models" learned-quality path. Deterministic
    # synthetic feedback: haiku wins chat ties, gpt-mini loses them.
    samples: list[FeedbackSample] = []
    for i in range(12):
        req = RoutingRequest(messages=(Message("user", f"tie question {i}"),),
                             workload=WorkloadClass.CHAT)
        x = extract_features(req, WorkloadClass.CHAT)
        samples.append(FeedbackSample(x, "claude-haiku-class", 1.0))
        samples.append(FeedbackSample(x, "gpt-mini-class", 0.0))
    checkpoint, _ = train_heads(samples, epochs=120)

    learned = PolicyEngine(prices, default_backends(), WorkloadResolver(),
                           quality_model=checkpoint)

    rows: list[dict] = []
    for c in CASES:
        rows += serialize(plain, [c], "plain")
        rows += serialize(learned, [c], "learned")
    (DIR / "cases.json").write_text(json.dumps(
        {"cases": CASES, "checkpoint": json.loads(checkpoint.to_json())},
        indent=1,
    ))
    (DIR / "py.json").write_text(json.dumps(rows, indent=1))
    print(f"wrote {len(rows)} decisions to {DIR}")


if __name__ == "__main__":
    main()

# LLM Router

Cache-aware LLM routing: pick the **(model, backend) pair**, keep sessions
sticky so the prompt cache survives, and choose prompt-cache TTL **per
breakpoint**.

| Part | What it is | Install |
|---|---|---|
| [`llmrouter/`](llmrouter/) | Python package: full decision + execution + learning layers | `pip install llmrouter[http]` |
| [`npm/llmrouter/`](npm/llmrouter/) | Node.js package: the decision engine, 1:1 port, zero deps | `npm install llmrouter` |
| [`website/`](website/) | Docs site: what it is, how both packages work | open `website/index.html` |
| [`research/`](research/) | The research corpus the implementation is grounded in | start at `MASTER-REPORT.md` |

Both packages make the **same decision** for the same request: the price
cards, the scoring formulas (`R*` amortization, `E*` expiry threshold, mixed
TTL policy), the learned-quality checkpoints (`llmrouter-quality-v1`) and the
durable-state snapshots (`llmrouter-state-v1`) are shared artifacts, and the
cross-runtime parity suite asserts the decisions match byte-for-byte.

```bash
# Python — decisions, async execution, CLI
python -m llmrouter explain --prompt "hi" --workload chat

# Node.js — decisions, CLI
npx llmrouter explain --prompt "hi" --workload chat

# the loop: collect feedback -> train quality heads -> route with the checkpoint
python -m llmrouter train --data feedback.jsonl --out quality.json
python -m llmrouter eval --data cases.jsonl --ci --quality-model quality.json

# decision sidecar for LiteLLM / Bifrost / your own proxy (both runtimes)
python -m llmrouter serve --port 8787        # POST /decide
npx llmrouter serve --port 8787              # same wire format

# local GPU + cloud scored together, with honest $/MTok GPU economics
python -c "from llmrouter import Router; Router.with_ollama(openai_key='...')"
```

The Python engine also **streams** (`router.astream`, failover safe before the
first token) and can **persist every piece of learned state** (sessions, hit
rates, circuit health, pair economics) across restarts with
`Router.with_defaults(state_store=FileStateStore("state.json"))`.

Apache-2.0. The honest savings expectation is 30-40% at no more than 2%
quality loss; ship the `eval --ci` gate and measure your own traffic.

## Positioning (Oct 2026)

The landscape re-scan (`research/11-market-landscape-2026.md`) validates both
the claim and the niche:

- **The claim is conservative.** LiteLLM's published auto-router measures
  **37.4% savings on real agent traces** (95 sessions, 8,174 calls) — the top
  of our honest 30-40% ladder. Without cache awareness, they measured routing
  at ~4x a fixed cached model. vLLM's SAAR research independently confirms
  sticky-but-willing-to-switch as the right design point (78.7% savings at
  −0.045 quality; naive stickiness costs 3x the quality).
- **The niche is still open.** Quality routers are stale or stateless
  (RouteLLM: no commits since 2024; Not Diamond/Martian: no cache economics).
  Gateways bolt on binary session affinity (off by default). Nobody ships
  cache-economics-weighted cross-provider stickiness, per-breakpoint TTL
  choice, or a decide-sidecar posture.
- **Cache discounts now rival model-price gaps.** DeepSeek bills cache hits
  ~30x under misses, Gemini's implicit cache is 90% off — a cheaper model with
  a cold cache can lose to a warm expensive one. The bundled price matrix
  encodes these (`DEEPSEEK_CACHE`, `GEMINI_CACHE`, `KIMI_CACHE`,
  `OPENAI_CACHE_WRITE`); cards are opt-in until you register a backend.

# 11 — Market Landscape Refresh (October 2026)

**Purpose:** quarterly re-scan of the LLM-routing / gateway / prompt-cache
landscape, to (a) validate the bundled cache-price matrix, (b) position the
honest-savings claim against the newest measured data, and (c) re-rank the
open gaps this package fills. Method: ~16 web searches + primary-doc fetches,
2026-10-25. Source quality follows the ledger key in `00-RESEARCH-LOG.md`.

---

## 1. Landscape table

| Product | What it is | Cache-aware stickiness? | What it does NOT do |
|---|---|---|---|
| **OpenRouter** | Hosted marketplace/aggregator, 400+ models; ~5.5% credit fee | Yes — provider-sticky after a cached request, but opaque heuristics and message-hash fallbacks; users report re-misses on provider switches | No self-hosting; no per-breakpoint TTL choice; no quality learning; no routing to your own GPUs |
| **LiteLLM** | Dominant OSS gateway (~59k stars) | **Closest competitor.** Session affinity + cache-aware routing exist but are **off by default and binary** (on/off, not economics-weighted) | No learned quality routing; no TTL optimization; monolithic proxy adoption required |
| **Portkey** | Governance/observability gateway | No — semantic + exact-match response caching (a different thing from provider prompt-cache hits) | No cross-provider cache-economics routing; semantic caching is enterprise-gated |
| **Bifrost** | Go gateway selling raw speed (11 µs overhead claim) | No | No cache-aware or quality routing |
| **Not Diamond / Martian** | Managed quality routers | No — single-turn quality only | Stateless; no cost/cache economics; closed source |
| **RouteLLM (LMSYS)** | OSS router, ICLR 2025 | No | No commits since 2024-08 — effectively abandoned |
| **vLLM Semantic Router** (Red Hat) | Signal-driven "mixture-of-models" router | Routes to local vLLM pools; KV-cache-aware scheduling **within** a pool (via llm-d) | Not about provider-side prompt-cache billing across Anthropic/OpenAI/etc. |
| **vLLM SAAR** (blog, Jun 2026) | Session-aware agentic routing research | **Yes — intellectually the closest work.** Switch economics: handoff cost + "cached-input checkout delta" + hard locks for tool loops | A reference design, not a shipped library |
| **Cloudflare / Vercel gateways** | Edge gateways | Exact-match response caching only | No provider prompt-cache routing |
| **llm-d / SGLang / TrueFoundry** | KV-cache-aware scheduling for self-hosted pools | Yes — but across *your own replicas*, not across paid providers | Doesn't choose between Anthropic vs OpenAI vs DeepSeek on cache economics |

**Read of the field:** quality-routing is commoditized and partly abandoned
(RouteLLM stale, Not Diamond/Martian niche); gateways compete on governance and
speed; nobody ships cache-economics-weighted cross-provider stickiness as a
product. vLLM's SAAR validates the *design point* (sticky-but-willing-to-switch)
academically.

## 2. Prompt-cache economics, refreshed (the numbers the price matrix encodes)

| Provider | Read discount | Write premium | Floor / TTL notes |
|---|---|---|---|
| Anthropic | 0.10× (90% off) | **1.25× (5m) / 2.00× (1h)** | 1,024-token floor (4,096 for Haiku-class); mixed TTL allowed, longer tier must precede shorter |
| OpenAI legacy (gpt-4o/4.1) | 0.50× | none | automatic, ≥1,024 tokens, `prompt_cache_key` exposed |
| OpenAI GPT-5.x | 0.10× | none pre-5.6 | 2026 shift: newer models add an explicit **cache-write bucket** (three-bucket billing). Magnitude not verifiable from primary docs — modeled as a 1.25× placeholder in `OPENAI_CACHE_WRITE`, override from your invoice |
| Gemini | 0.10× implicit (raised from 0.25×) | none (implicit) | **2,048-token floor**; 5m refreshable; explicit caching adds a storage fee |
| DeepSeek | **~1/30×** (hit tokens ~30× cheaper) | none | 64-token blocks; automatic; off-peak billing is half of peak |
| Kimi (Moonshot) | ~0.10–0.20× depending on model | none | documented inconsistently across models (LiteLLM #17417); bundled card encodes the 0.20 tier |

Two structural observations:

1. **Cache discounts now rival or exceed model-to-model price gaps.** A 5×
   cheaper model with a cold cache can lose to a warm-cache expensive model —
   LiteLLM measured that routing without caching enabled costs **~4×** a fixed
   cached model. This is the core thesis of the R\* switch algebra; the market
   caught up to it in 2026.
2. **Cache-write pricing is spreading** (OpenAI's bucket era, Anthropic's
   premium, Gemini's explicit-storage fee). "When is a cache write worth it"
   is becoming a first-class billing problem, which is exactly what
   `economics.py` prices and what no gateway exposes.

## 3. Validation of the honest-savings claim

LiteLLM's auto-router (published 2026, primary docs):

- WildChat-1M (30,769 multi-turn conversations): **68.7% cheaper**
- DevGPT (1,011 conversations): **46% cheaper**
- **Real agent traces (95 sessions, 8,174 calls): 37.4% cheaper**
- 4,684 real switch-backs: 97.4% cache still warm at 5m TTL, 99.3% at 1h

Our shipped claim — *30–40% at ≤2% quality loss* — sits exactly on their
real-agent-traces measurement (37.4%) and is therefore conservative and
defensible. vLLM SAAR independently: sticky-only = 98.65% savings at −0.143
quality; economics-weighted sticky = 78.7% at −0.045. The correct design point
is sticky-but-willing-to-switch, which is what `evaluate_switch` implements.

## 4. Gap re-ranking (what this package fills that nobody else ships)

1. **Cross-provider cache-economics routing** — jointly choosing cheapest
   (model, backend) pair *with cache state*. LiteLLM routes models or pods;
   OpenRouter won't route to your GPUs. Still unfilled.
2. **Per-breakpoint TTL selection** — Anthropic 5m/1h break-even (E\* = 0.652),
   OpenAI's write bucket. No gateway exposes intelligent TTL choice. Unfilled.
3. **Sidecar posture** — every competitor is a monolithic gateway; the
   `/decide` sidecar upgrades LiteLLM/Bifrost *in place*. Unfilled.
4. **Maintained cache-price matrix** — Moonshot's inconsistent docs and 2026's
   billing changes make a verified per-model cache-semantics table itself a
   moat. This refresh is that maintenance pass.

**Threats:** LiteLLM shipping its auto-router harder (data + 59k-star
distribution); vLLM SR/SAAR momentum with Red Hat backing; OpenRouter
improving stickiness server-side where it's free.

## Sources

- Anthropic prompt caching — platform.claude.com/docs/en/build-with-claude/prompt-caching
- OpenAI prompt caching guide — developers.openai.com/api/docs/guides/prompt-caching; openai.com/index/api-prompt-caching; openai.com/index/better-prompt-caching-for-gpt-6
- Pointfive, "Azure OpenAI: the token tax you're paying on every call" — pointfive.co/blog/prompt-caching-on-azure-openai-the-token-tax-youre-paying-on-every-call
- Gemini pricing — ai.google.dev/gemini-api/docs/pricing
- DeepSeek pricing — api-docs.deepseek.com/quick_start/pricing
- LiteLLM auto-router (prompt caching) — docs.litellm.ai/docs/auto_router/prompt_caching; cache-aware routing — docs.litellm.ai/docs/proxy/cache_aware_routing
- vLLM SAAR — vllm.ai/blog/2026-06-02-session-aware-agentic-routing
- vLLM Semantic Router — vllm.ai/blog/2026-01-05-vllm-sr-iris; vllm-sr.ai
- OpenRouter sticky routing — openrouter.ai/docs/guides/best-practices/prompt-caching; TrueFoundry critique — truefoundry.com/blog/openrouter-prompt-caching-when-it-saves-money-and-when-it-quietly-costs-more
- Bifrost — github.com/maximhq/bifrost; Portkey cache — docs.portkey.ai/docs/product/ai-gateway/cache-simple-and-semantic; Cloudflare — developers.cloudflare.com/ai-gateway/features/caching
- llm-d — llm-d.ai/blog/kvcache-wins-you-can-see
- RouteLLM — github.com/lm-sys/routellm; arxiv.org/abs/2406.18665
- Kimi pricing — cloudzero.com/blog/kimi-api-pricing; LiteLLM issue #17417
- DoiT AI spending survey — doit.com/blog/ai-spending-survey
- Live model price tracker — artificialanalysis.ai/models

*Unverified tier (single-source, flagged): exact OpenAI write-bucket
multiplier; anecdotal claim that Anthropic 1h writes bill closer to 1.2× in
practice. Both are override-fields by design.*

/* llmrouter docs site — tabs, copy, stage viewer, code segments, strip, reveal */
(() => {
  "use strict";

  /* ------------------------- install tabs -------------------------- */
  const tabs = [...document.querySelectorAll(".tabs .tab")];
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
    });
  });

  /* ------------------------------ copy ------------------------------ */
  const flash = (btn, label) => {
    const el = btn.querySelector(".chip-act") || btn;
    const prev = el.textContent;
    el.textContent = label;
    btn.classList.add("done");
    setTimeout(() => { el.textContent = prev; btn.classList.remove("done"); }, 1500);
  };
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        flash(btn, "copied");
      } catch {
        flash(btn, "ctrl+c");
      }
    });
  });

  /* -------------------------- stage viewer -------------------------- */
  const STAGES = [
    {
      title: "Classify",
      desc: "Structural rules and a prompt fingerprint pick the workload class for free — no model call, no network. Only when both abstain does the classifier hook run, once, on turn one, amortized over the whole session; adapters for Laya, Verdict, GLiClass or any callable ship for that slot.",
      facts: ["Path A declared intent", "Fingerprint learns per application", "Clean abstention on failure"],
    },
    {
      title: "Score",
      desc: "Every (model, backend) pair is scored on quality, cost, latency, switch cost and measured affinity, under hard constraints: residency, context window, tool support, budget caps and closed-loop pacing. Local GPUs are priced in honest $/MTok from the GPU's hourly rent.",
      facts: ["Pairs, not models", "Learned quality heads optional", "Cold rescore on cache-key drift"],
    },
    {
      title: "Decide",
      desc: "Sessions are sticky by default — rendezvous hashing survives backend changes. A migration must pay back the cache it destroys inside the turns remaining; if it cannot, the session stays put and a stranded counter increments where the operator can see it.",
      facts: ["R* amortization test", "No-oscillation lock", "Mixed TTL per breakpoint"],
    },
    {
      title: "Execute and learn",
      desc: "Python executes with retries and cross-model failover that never breaks the first streamed token. Every response's usage counters fold back into the session's hit-rate estimate, feedback JSONL trains quality heads, and the eval --ci gate blocks regressions before merge.",
      facts: ["Streaming-safe failover", "Usage-counter learning", "CI gate on every merge"],
    },
  ];
  let stage = 0;
  const plate = document.getElementById("stage-plate");
  const pills = [...document.querySelectorAll(".pill-dot")];
  const showStage = (i) => {
    stage = (i + STAGES.length) % STAGES.length;
    const s = STAGES[stage];
    document.getElementById("stage-count").textContent =
      String(stage + 1).padStart(2, "0") + " / 04";
    document.getElementById("stage-title").textContent = s.title;
    document.getElementById("stage-desc").textContent = s.desc;
    document.getElementById("stage-facts").innerHTML =
      s.facts.map((f) => `<li>${f}</li>`).join("");
    pills.forEach((p, j) => {
      p.classList.toggle("active", j === stage);
      p.setAttribute("aria-selected", String(j === stage));
    });
    if (plate) {
      plate.classList.remove("stage-fade");
      void plate.offsetWidth; // restart the entrance
      plate.classList.add("stage-fade");
    }
  };
  pills.forEach((p) =>
    p.addEventListener("click", () => showStage(Number(p.dataset.stage))));
  const prev = document.getElementById("stage-prev");
  const next = document.getElementById("stage-next");
  if (prev) prev.addEventListener("click", () => showStage(stage - 1));
  if (next) next.addEventListener("click", () => showStage(stage + 1));
  if (plate) showStage(0);

  /* ------------------------- quickstart code ------------------------ */
  const PY = `import asyncio
from llmrouter import Message, Router

router = Router.with_defaults(
    anthropic_key="sk-...", openai_key="sk-...",
    sidekick_model="gpt-mini-class",
)

async def main():
    out = await router.acomplete(
        [Message("system", "You are a support bot."),
         Message("user", "hi")],
        session_id="user-42",   # keeps the prompt cache warm
        workload="chat",
    )
    print(out.text)
    print(router.explain())     # every decision is auditable

asyncio.run(main())`;

  const TS = `import {
  Message, RoutingRequest, WorkloadClass,
  PolicyEngine, PriceRegistry, BackendRegistry,
} from "llmrouter";

const engine = new PolicyEngine(
  new PriceRegistry(), new BackendRegistry(),
);

const decision = engine.decide(new RoutingRequest(
  [new Message("user", "refactor this function")],
  WorkloadClass.Code,
  "user-42",                 // session id: sticky caching
));

decision.modelId;            // "gpt-frontier-class"
decision.backendId;          // "openai"
decision.ttlBySegment;       // system=>1h, history=>5m
console.log(decision.explain());`;

  const SH = `# the decide-sidecar, both runtimes, one wire format
python -m llmrouter serve --port 8787
npx llmrouter serve --port 8787

curl -s localhost:8787/decide \\
  -H 'content-type: application/json' \\
  -d '{"messages":[{"role":"user",
       "content":"extract fields"}],
       "workload":"batch","session_id":"t-9"}'

# {
#   "model_id": "claude-haiku-class",
#   "backend_id": "anthropic",
#   "ttl_by_segment": {"system": "1h"},
#   "candidates": [ ... six scored pairs ... ],
#   "reasons": ["workload=batch via explicit_tag: ..."]
# }`;

  const CODES = { py: PY, ts: TS, sh: SH };
  const codeEl = document.getElementById("qs-code");
  document.querySelectorAll(".seg-b").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".seg-b").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-selected", String(x === b));
      });
      if (codeEl) codeEl.textContent = CODES[b.dataset.code] ?? "";
    });
  });
  if (codeEl) codeEl.textContent = PY;

  /* --------------------------- reveal on scroll --------------------- */
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = [...document.querySelectorAll(".reveal")];
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    items.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 70}ms`;
      io.observe(el);
    });
  }
})();

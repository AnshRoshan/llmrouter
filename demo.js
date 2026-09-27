/**
 * Live routing demo — runs the REAL llmrouter decision engine (the same
 * TypeScript modules published to npm) in your browser. No network: the
 * engine is pure decision logic, so the demo works offline.
 */
import { Message, RoutingRequest, WorkloadClass, DeploymentClass } from "./assets/engine/types.js";
import { PriceRegistry } from "./assets/engine/pricing.js";
import { BackendRegistry, BackendSpec } from "./assets/engine/backends.js";
import { PolicyEngine } from "./assets/engine/policy.js";

const prices = new PriceRegistry();
const ids = prices.ids();
const engine = new PolicyEngine(
  prices,
  new BackendRegistry([
    new BackendSpec("anthropic", {
      deployment: DeploymentClass.Api,
      models: ids.filter((m) => m.startsWith("claude")),
      priority: 0,
    }),
    new BackendSpec("openai", {
      deployment: DeploymentClass.Api,
      models: ids.filter((m) => m.startsWith("gpt")),
      priority: 1,
    }),
  ]),
);

const $ = (id) => document.getElementById(id);

function route() {
  const prompt = $("demo-prompt").value.trim() || "hello";
  const system = $("demo-system").value;
  const session = $("demo-session").value.trim() || null;
  const workloadSel = $("demo-workload").value;
  const gap = parseFloat($("demo-gap").value);
  const pool = $("demo-pool") ? $("demo-pool").value : "all";

  const messages = [];
  if (system.trim()) messages.push(new Message("system", system));
  messages.push(new Message("user", prompt));

  const allowed =
    pool === "anthropic" ? new Set(ids.filter((m) => m.startsWith("claude")))
    : pool === "openai" ? new Set(ids.filter((m) => m.startsWith("gpt")))
    : new Set();

  const req = new RoutingRequest(
    messages,
    workloadSel === "auto" ? null : WorkloadClass[workloadSel],
    session,
    null, [], [], new Set(),
    allowed.size ? { allowedModels: allowed } : {},
    null,
    Number.isFinite(gap) ? gap : null,
  );

  const t0 = performance.now();
  let decision;
  try {
    decision = engine.decide(req);
  } catch (err) {
    $("demo-out").innerHTML =
      `<div class="demo-fail"><span class="df-title">unroutable</span>` +
      `<span class="df-msg">${esc(err.message)}</span></div>`;
    return;
  }
  const decideMs = performance.now() - t0;
  render(decision, decideMs);
}

function render(d, decideMs) {
  const chosen = d.candidates.find(
    (c) => c.modelId === d.modelId && c.backendId === d.backendId,
  ) ?? d.candidates[0];
  const scores = d.candidates.map((c) => c.score);
  const lo = Math.min(...scores), hi = Math.max(...scores);
  const span = hi - lo || 1;

  const ttl = [...d.ttlBySegment.entries()]
    .map(([k, v]) => `<span class="t-chip">${k} <b>${v}</b></span>`)
    .join("") || `<span class="t-chip none">no explicit tiers on this backend</span>`;

  const sessionBits = [
    d.reusedSession ? `<span class="s-chip ok">session reused</span>` :
                     `<span class="s-chip">new session</span>`,
    d.switched ? `<span class="s-chip warn">migrated</span>` : "",
    d.stranded ? `<span class="s-chip warn">stranded++</span>` : "",
  ].join("");

  const rows = d.candidates.map((c) => {
    const pick = c === chosen;
    const width = Math.max(4, ((c.score - lo) / span) * 100);
    return `<div class="demo-row${pick ? " picked" : ""}">
      <div class="dr-top">
        <span class="dr-name">${esc(c.modelId)}<span class="dr-at">@${esc(c.backendId)}</span></span>
        <span class="dr-nums">
          <span class="dr-score ${pick ? "accent" : ""}">${c.score >= 0 ? "+" : ""}${c.score.toFixed(4)}</span>
          <span class="dr-q">q ${c.quality.toFixed(2)}</span>
          <span class="dr-c">$${c.costUsd.toFixed(5)}</span>
          <span class="dr-l">${c.latencyMs.toFixed(0)}ms</span>
          ${c.switchCostUsd > 0 ? `<span class="dr-sw">switch $${c.switchCostUsd.toFixed(5)}</span>` : ""}
          ${c.affinity > 0 ? `<span class="dr-af">warm ${(c.affinity * 100).toFixed(0)}%</span>` : ""}
        </span>
      </div>
      <div class="dr-bar"><i style="width:${width.toFixed(1)}%"></i></div>
    </div>`;
  }).join("");

  const reasons = d.reasons.map((r) => `<li>${esc(r)}</li>`).join("");

  $("demo-out").innerHTML = `
    <div class="demo-head">
      <div>
        <span class="dh-eyebrow mono">selected pair</span>
        <div class="dh-model">${esc(d.modelId)}<span class="dh-at">@${esc(d.backendId)}</span></div>
      </div>
      <div class="dh-stats">
        <span class="stat"><b>${decideMs.toFixed(2)}</b><i>ms to decide</i></span>
        <span class="stat"><b>$${chosen.costUsd.toFixed(5)}</b><i>est / turn</i></span>
        <span class="stat"><b>${d.workload}</b><i>${esc(d.workloadSource)} · conf ${d.workloadConfidence.toFixed(2)}</i></span>
      </div>
    </div>
    <div class="demo-strip">${sessionBits}${ttl}</div>
    <div class="demo-rows">${rows}</div>
    <details class="demo-log" open>
      <summary class="mono">decision trace</summary>
      <ul>${reasons}</ul>
    </details>
    <p class="demo-hint">Route again with the same session id to see the reuse chip and the
    affinity bonus appear; raise the idle gap past 300s to watch the 1-hour TTL kick in.</p>`;
}

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

$("demo-route").addEventListener("click", route);

// auto-reroute on any control change (debounced) — the panel should feel live
let timer = null;
const rerouteSoon = () => {
  clearTimeout(timer);
  timer = setTimeout(route, 350);
};
for (const id of ["demo-prompt", "demo-workload", "demo-session",
                  "demo-pool", "demo-gap", "demo-system"]) {
  const el = $(id);
  if (el) el.addEventListener("input", rerouteSoon);
}
route();

/**
 * The 2026 cache-price matrix — mirrors tests/test_pricing.py in the Python
 * package. Multipliers verified; $ figures pin the bundled defaults only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANTHROPIC_CACHE,
  DEEPSEEK_CACHE,
  DEEPSEEK_OFF_PEAK_MULT,
  DEEPSEEK_PEAK_WINDOWS_UTC,
  GEMINI_CACHE,
  KIMI_CACHE,
  OPENAI_CACHE_CURRENT,
  OPENAI_CACHE_WRITE,
  PriceCard,
  PriceRegistry,
  defaultPriceCards,
} from "../dist/pricing.js";
import { BackendRegistry } from "../dist/backends.js";
import { PolicyEngine } from "../dist/policy.js";
import { WorkloadResolver } from "../dist/signals.js";

test("deepseek hit is thirty times cheaper", () => {
  const card = new PriceCard("ds", 0.30, 1.20, DEEPSEEK_CACHE);
  assert.ok(
    Math.abs(card.cacheReadCost(1_000_000) * 30 - card.inputCost(1_000_000)) < 1e-9,
  );
});

test("deepseek has no write premium and no ttl choice", () => {
  assert.equal(DEEPSEEK_CACHE.writeMult("5m"), 1.0);
  assert.equal(DEEPSEEK_CACHE.writeMult("1h"), 1.0);
  assert.ok(!DEEPSEEK_CACHE.ttlOptions.includes("1h"));
});

test("gemini floor is 2048", () => {
  assert.equal(GEMINI_CACHE.canCache(2047), false);
  assert.equal(GEMINI_CACHE.canCache(2048), true);
  assert.equal(GEMINI_CACHE.readMult, 0.10);
});

test("kimi read tier", () => {
  const card = new PriceCard("kimi", 0.75, 3.50, KIMI_CACHE);
  assert.ok(Math.abs(card.cacheReadCost(1_000_000) - 0.15) < 1e-9);
});

test("openai write era has a premium legacy does not", () => {
  assert.ok(OPENAI_CACHE_WRITE.writeMult("5m") > 1.0);
  assert.equal(OPENAI_CACHE_CURRENT.writeMult("5m"), 1.0);
  assert.equal(ANTHROPIC_CACHE.supportsMixedTtl, true);
});

test("matrix covers the cache economics leaders", () => {
  const ids = new Set([...defaultPriceCards().keys()]);
  for (const id of ["deepseek-class", "gemini-class", "kimi-class"]) {
    assert.ok(ids.has(id), id);
  }
});

test("every prior has a vision entry", () => {
  for (const card of defaultPriceCards().values()) {
    assert.ok("vision" in card.qualityPrior, card.modelId);
  }
});

// ---- time-aware pricing (DeepSeek peak/off-peak) — mirrors the Python suite

const utc = (y, mo, d, h, mi) => new Date(Date.UTC(y, mo - 1, d, h, mi));

test("deepseek peak windows pricing", () => {
  const card = defaultPriceCards().get("deepseek-class");
  const tuesdayPeak = utc(2026, 10, 20, 2, 0);   // Tue 02:00 UTC
  const tuesdayOff = utc(2026, 10, 20, 12, 0);   // Tue 12:00 UTC
  assert.equal(card.isPeak(tuesdayPeak), true);
  assert.equal(card.isPeak(tuesdayOff), false);
  assert.ok(Math.abs(card.effectiveInputPerMtok(tuesdayPeak) - 0.30) < 1e-9);
  assert.ok(Math.abs(card.effectiveInputPerMtok(tuesdayOff) - 0.15) < 1e-9);
});

test("weekends always off peak", () => {
  const card = defaultPriceCards().get("deepseek-class");
  const saturdayPeakWall = utc(2026, 10, 24, 2, 0); // Sat 02:00 UTC
  assert.equal(card.isPeak(saturdayPeakWall), false);
  assert.ok(Math.abs(card.effectiveInputPerMtok(saturdayPeakWall) - 0.15) < 1e-9);
});

test("null is deterministic list price", () => {
  const card = defaultPriceCards().get("deepseek-class");
  assert.equal(card.inputMultiplier(), 1.0);
  assert.equal(card.effectiveInputPerMtok(), card.inputPerMtok);
});

test("flat pricing cards ignore time", () => {
  const card = defaultPriceCards().get("claude-sonnet-class");
  assert.equal(card.isPeak(utc(2026, 10, 20, 2, 0)), false);
  assert.equal(card.effectiveInputPerMtok(utc(2026, 10, 20, 12, 0)), card.inputPerMtok);
});

test("turn cost discounted off peak", () => {
  const engine = new PolicyEngine(new PriceRegistry(), new BackendRegistry(), new WorkloadResolver());
  const card = defaultPriceCards().get("deepseek-class");
  const peak = engine.estimateTurnCost(card, 10_000, 0.0, 500, utc(2026, 10, 20, 2, 0));
  const off = engine.estimateTurnCost(card, 10_000, 0.0, 500, utc(2026, 10, 20, 12, 0));
  assert.ok(off < peak);
  assert.ok(Math.abs((peak - off) - (10_000 / 1_000_000) * 0.30 * 0.5) < 1e-12);
});

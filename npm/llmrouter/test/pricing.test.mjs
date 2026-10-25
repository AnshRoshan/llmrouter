/**
 * The 2026 cache-price matrix — mirrors tests/test_pricing.py in the Python
 * package. Multipliers verified; $ figures pin the bundled defaults only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANTHROPIC_CACHE,
  DEEPSEEK_CACHE,
  GEMINI_CACHE,
  KIMI_CACHE,
  OPENAI_CACHE_CURRENT,
  OPENAI_CACHE_WRITE,
  PriceCard,
  defaultPriceCards,
} from "../dist/pricing.js";

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

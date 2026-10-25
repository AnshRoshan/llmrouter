"""The 2026 cache-price matrix (research/11-market-landscape-2026.md).

The *multipliers* are the verified part (DeepSeek ~30x hit discount, Gemini
90% off with a 2048-token floor, Kimi's 0.20 tier, Anthropic's write premium
vs OpenAI's three-bucket write era). Absolute $ figures are illustrative
class-cards and are asserted only to pin the bundled defaults.
"""
from __future__ import annotations

import pytest

from llmrouter import (
    DEEPSEEK_CACHE,
    GEMINI_CACHE,
    KIMI_CACHE,
    OPENAI_CACHE_WRITE,
    PriceCard,
    default_price_cards,
)
from llmrouter.pricing import ANTHROPIC_CACHE, OPENAI_CACHE_CURRENT


class TestCacheMatrix:
    def test_deepseek_hit_is_thirty_times_cheaper(self):
        card = PriceCard("ds", 0.30, 1.20, DEEPSEEK_CACHE)
        assert card.cache_read_cost(1_000_000) * 30 == pytest.approx(
            card.input_cost(1_000_000)
        )

    def test_deepseek_has_no_write_premium_and_no_ttl_choice(self):
        assert DEEPSEEK_CACHE.write_mult("5m") == 1.0
        assert DEEPSEEK_CACHE.write_mult("1h") == 1.0
        assert "1h" not in DEEPSEEK_CACHE.ttl_options

    def test_gemini_floor_is_2048(self):
        assert not GEMINI_CACHE.can_cache(2047)
        assert GEMINI_CACHE.can_cache(2048)
        assert GEMINI_CACHE.read_mult == 0.10

    def test_kimi_read_tier(self):
        card = PriceCard("kimi", 0.75, 3.50, KIMI_CACHE)
        assert card.cache_read_cost(1_000_000) == pytest.approx(0.15)

    def test_openai_write_era_has_a_premium_legacy_does_not(self):
        assert OPENAI_CACHE_WRITE.write_mult("5m") > 1.0
        assert OPENAI_CACHE_CURRENT.write_mult("5m") == 1.0
        # Anthropic remains the only mixed-TTL provider in the matrix.
        assert ANTHROPIC_CACHE.supports_mixed_ttl

    def test_matrix_covers_the_cache_economics_leaders(self):
        ids = set(default_price_cards())
        assert {"deepseek-class", "gemini-class", "kimi-class"} <= ids

    def test_every_prior_has_a_vision_entry(self):
        # A vision request scored against a card whose prior lacks "vision"
        # silently falls back to the 0.5 neutral default — the bundled cards
        # must not have that hole.
        for card in default_price_cards().values():
            assert "vision" in card.quality_prior, card.model_id

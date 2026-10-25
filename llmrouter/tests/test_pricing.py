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
    DEEPSEEK_OFF_PEAK_MULT,
    DEEPSEEK_PEAK_WINDOWS_UTC,
    GEMINI_CACHE,
    KIMI_CACHE,
    OPENAI_CACHE_WRITE,
    PriceCard,
    PriceRegistry,
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


class TestTimeAwarePricing:
    """DeepSeek peak/off-peak: half-price input outside 01:00-04:00 /
    06:00-10:00 UTC Mon-Fri; deterministic (list price) when at_utc is None."""

    @staticmethod
    def _utc(y, mo, d, h, mi):
        from datetime import datetime, timezone
        return datetime(y, mo, d, h, mi, tzinfo=timezone.utc)

    def test_peak_windows_pricing(self):
        card = default_price_cards()["deepseek-class"]
        tuesday_peak = self._utc(2026, 10, 20, 2, 0)      # Tue 02:00 UTC
        tuesday_off = self._utc(2026, 10, 20, 12, 0)      # Tue 12:00 UTC
        assert card.is_peak(tuesday_peak)
        assert not card.is_peak(tuesday_off)
        assert card.effective_input_per_mtok(tuesday_peak) == pytest.approx(0.30)
        assert card.effective_input_per_mtok(tuesday_off) == pytest.approx(0.15)

    def test_weekends_always_off_peak(self):
        card = default_price_cards()["deepseek-class"]
        saturday_peak_wall = self._utc(2026, 10, 24, 2, 0)  # Sat 02:00 UTC
        assert not card.is_peak(saturday_peak_wall)
        assert card.effective_input_per_mtok(saturday_peak_wall) == pytest.approx(0.15)

    def test_none_is_deterministic_list_price(self):
        card = default_price_cards()["deepseek-class"]
        assert card.input_multiplier() == 1.0
        assert card.effective_input_per_mtok() == card.input_per_mtok

    def test_flat_pricing_cards_ignore_time(self):
        card = default_price_cards()["claude-sonnet-class"]
        assert card.is_peak(self._utc(2026, 10, 20, 2, 0)) is False
        assert card.effective_input_per_mtok(
            self._utc(2026, 10, 20, 12, 0)) == card.input_per_mtok

    def test_turn_cost_discounted_off_peak(self):
        from llmrouter import PolicyEngine, BackendRegistry, WorkloadResolver
        engine = PolicyEngine(PriceRegistry(), BackendRegistry(), WorkloadResolver())
        card = default_price_cards()["deepseek-class"]
        peak = engine.estimate_turn_cost(
            card, 10_000, 0.0, at_utc=self._utc(2026, 10, 20, 2, 0))
        off = engine.estimate_turn_cost(
            card, 10_000, 0.0, at_utc=self._utc(2026, 10, 20, 12, 0))
        assert off < peak
        # output is not discounted: peak cost is not exactly half of nothing,
        # the output term stays constant across windows
        diff_input = (peak - off)
        assert diff_input == pytest.approx(10_000 / 1_000_000 * 0.30 * 0.5)


class TestProviderConstructors:
    def test_with_deepseek_registers_backend_and_card(self):
        from llmrouter import Router
        router = Router.with_deepseek(deepseek_key="sk-test")
        assert "deepseek" in router.backends.ids()
        card = router.prices.require("deepseek-class")
        assert card.off_peak_input_mult == 0.5

    def test_with_gemini_and_kimi(self):
        from llmrouter import Router
        r1 = Router.with_gemini(gemini_key="k")
        assert "gemini" in r1.backends.ids()
        r2 = Router.with_kimi(kimi_key="k")
        assert "kimi" in r2.backends.ids()

    def test_with_defaults_accepts_new_keys(self):
        from llmrouter import Router
        router = Router.with_defaults(openai_key="k", deepseek_key="d",
                                      gemini_key="g", kimi_key="m")
        assert set(router.backends.ids()) == {"openai", "deepseek", "gemini", "kimi"}

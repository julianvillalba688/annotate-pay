import unittest

from app.models.schemas import coerce_task_log
from app.services.analytics_service import build_analytics_summary
from app.services.earnings import compute_hours
from app.services.export_service import normalize_export_rows


class EarningsMappingTests(unittest.TestCase):
    def test_zero_usd_backfill_uses_positive_canonical_earnings(self) -> None:
        raw = {
            "calculated_earnings_usd": 0,
            "calculated_earnings": 12.5,
        }

        coerced = coerce_task_log(raw)
        exported = normalize_export_rows([raw])[0]
        summary = build_analytics_summary([raw])

        self.assertEqual(coerced["earnings_usd"], 12.5)
        self.assertEqual(exported["earnings_usd"], 12.5)
        self.assertEqual(summary.kpis.total_earned, 12.5)

    def test_legitimate_zero_earnings_stays_zero(self) -> None:
        raw = {
            "calculated_earnings_usd": 0,
            "calculated_earnings": 0,
        }

        self.assertEqual(coerce_task_log(raw)["earnings_usd"], 0)
        self.assertEqual(normalize_export_rows([raw])[0]["earnings_usd"], 0)
        self.assertEqual(build_analytics_summary([raw]).kpis.total_earned, 0)

    def test_positive_usd_snapshot_remains_authoritative(self) -> None:
        raw = {
            "calculated_earnings_usd": 7.5,
            "calculated_earnings": 12.5,
        }

        self.assertEqual(coerce_task_log(raw)["earnings_usd"], 7.5)
        self.assertEqual(normalize_export_rows([raw])[0]["earnings_usd"], 7.5)

    def test_minutes_formula_uses_sixty_minutes_per_hour(self) -> None:
        self.assertEqual(compute_hours(2, 4, 30, 15), 2.0)


if __name__ == "__main__":
    unittest.main()

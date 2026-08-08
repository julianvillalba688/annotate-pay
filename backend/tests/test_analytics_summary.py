import unittest
from unittest.mock import AsyncMock
from uuid import UUID

from app.auth import AuthUser
from app.models.schemas import GroupBy
from app.routers.analytics import analytics_summary
from app.services.analytics_service import build_analytics_summary


class AnalyticsSummaryTests(unittest.TestCase):
    def test_mixed_roles_are_combined(self) -> None:
        summary = build_analytics_summary(
            [
                {"tasks_attempter": 3, "tasks_reviewer": 2},
                {"tasks_attempter": 1, "tasks_reviewer": 4},
            ]
        )

        self.assertEqual(summary.kpis.total_tasks_attempter, 4)
        self.assertEqual(summary.kpis.total_tasks_reviewer, 6)
        self.assertEqual(summary.kpis.total_tasks_completed, 10)

    def test_only_attempter_tasks_count_as_completed(self) -> None:
        summary = build_analytics_summary([{"tasks_attempter": 7}])

        self.assertEqual(summary.kpis.total_tasks_completed, 7)

    def test_only_reviewer_tasks_count_as_completed(self) -> None:
        summary = build_analytics_summary([{"tasks_reviewer": 9}])

        self.assertEqual(summary.kpis.total_tasks_completed, 9)

    def test_zero_tasks_return_zero_completed(self) -> None:
        summary = build_analytics_summary(
            [{"tasks_attempter": 0, "tasks_reviewer": 0}]
        )

        self.assertEqual(summary.kpis.total_tasks_completed, 0)


class AnalyticsFilterTests(unittest.IsolatedAsyncioTestCase):
    async def test_project_filter_is_forwarded_before_aggregation(self) -> None:
        project_id = UUID("11111111-1111-1111-1111-111111111111")
        supabase = AsyncMock()
        supabase.fetch_task_logs.return_value = [
            {"project_id": str(project_id), "tasks_attempter": 2, "tasks_reviewer": 3}
        ]

        summary = await analytics_summary(
            project_id=project_id,
            date_from=None,
            date_to=None,
            group_by=GroupBy.month,
            _user=AuthUser(
                user_id="user-id",
                email=None,
                role="authenticated",
                raw_claims={},
            ),
            supabase=supabase,
        )

        supabase.fetch_task_logs.assert_awaited_once_with(
            project_id=project_id,
            date_from=None,
            date_to=None,
        )
        self.assertEqual(summary.kpis.total_tasks_completed, 5)


if __name__ == "__main__":
    unittest.main()

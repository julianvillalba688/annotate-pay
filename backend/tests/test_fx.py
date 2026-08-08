import time
import unittest
from unittest.mock import patch

import httpx
from fastapi import FastAPI, HTTPException

from app.routers.fx import router
from app.services import fx


def provider_payload() -> dict[str, object]:
    return {
        "result": "success",
        "time_last_update_utc": "Thu, 07 Aug 2026 00:00:01 +0000",
        "rates": {
            "USD": 1,
            "EUR": 0.92,
            "GBP": 0.79,
            "CAD": 1.36,
            "MXN": 18.7,
            "COP": 4200,
            "BRL": 5.5,
            "AUD": 1.5,
            "JPY": 150,
        },
    }


class FxServiceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.original_cache = {
            key: value.copy() if isinstance(value, dict) else value
            for key, value in fx._cache.items()
        }
        fx._cache.update(
            {
                "fetched_at": 0.0,
                "as_of": None,
                "source": None,
                "refresh_failed": False,
                "rates_from_usd": {},
            }
        )

    def tearDown(self) -> None:
        fx._cache.clear()
        fx._cache.update(self.original_cache)

    def test_provider_parsing_and_inversion(self) -> None:
        rates = fx._parse_rates(
            {
                "rates": {
                    " eur ": "0.92",
                    "COP": 4200,
                    "invalid": "not-a-number",
                    "zero": 0,
                }
            }
        )

        converted = {
            row["code"]: row["rate_to_usd"] for row in fx._rates_to_usd(rates)
        }
        self.assertAlmostEqual(converted["EUR"], 1 / 0.92)
        self.assertAlmostEqual(converted["COP"], 1 / 4200)
        self.assertEqual(converted["USD"], 1.0)
        self.assertNotIn("INVALID", converted)

    def test_provider_timestamp_is_not_reduced_to_a_date(self) -> None:
        self.assertEqual(
            fx._provider_as_of(provider_payload()),
            "Thu, 07 Aug 2026 00:00:01 +0000",
        )
        self.assertEqual(fx._provider_as_of({"date": "2026-08-07"}), "2026-08-07")

    async def test_er_api_is_primary_and_includes_cop(self) -> None:
        calls: list[tuple[str, dict[str, object]]] = []

        async def fake_get(
            _client: httpx.AsyncClient,
            url: str,
            **kwargs: object,
        ) -> httpx.Response:
            calls.append((url, kwargs))
            request = httpx.Request("GET", url)
            return httpx.Response(200, json=provider_payload(), request=request)

        with patch.object(httpx.AsyncClient, "get", new=fake_get):
            rates = await fx.ensure_rates(force_refresh=True)

        self.assertEqual(calls[0][0], fx.PRIMARY_FX_URL)
        self.assertEqual(len(calls), 1)
        self.assertEqual(rates["COP"], 4200.0)
        self.assertEqual(fx.cache_source(), "open.er-api.com")
        self.assertEqual(
            fx.cache_as_of(), "Thu, 07 Aug 2026 00:00:01 +0000"
        )

    async def test_frankfurter_is_used_only_after_primary_failure(self) -> None:
        calls: list[tuple[str, dict[str, object]]] = []

        async def fake_get(
            _client: httpx.AsyncClient,
            url: str,
            **kwargs: object,
        ) -> httpx.Response:
            calls.append((url, kwargs))
            request = httpx.Request("GET", url)
            if url == fx.PRIMARY_FX_URL:
                return httpx.Response(503, request=request)
            return httpx.Response(
                200,
                json={"date": "2026-08-07", "rates": provider_payload()["rates"]},
                request=request,
            )

        with patch.object(httpx.AsyncClient, "get", new=fake_get):
            await fx.ensure_rates(force_refresh=True)

        self.assertEqual(
            [call[0] for call in calls], [fx.PRIMARY_FX_URL, fx.FRANKFURTER_URL]
        )
        self.assertEqual(calls[1][1], {"params": {"base": "USD"}})
        self.assertEqual(fx.cache_source(), "frankfurter")
        self.assertEqual(fx.cache_as_of(), "2026-08-07")

    async def test_failed_refresh_keeps_last_known_rates_and_marks_stale(self) -> None:
        old_rates = {"USD": 1.0, "COP": 4000.0}
        fx._cache.update(
            {
                "fetched_at": time.monotonic(),
                "as_of": "Thu, 31 Jul 2026 00:00:01 +0000",
                "source": "open.er-api.com",
                "rates_from_usd": old_rates,
            }
        )

        async def failing_get(
            _client: httpx.AsyncClient,
            url: str,
            **_kwargs: object,
        ) -> httpx.Response:
            request = httpx.Request("GET", url)
            return httpx.Response(503, request=request)

        with patch.object(httpx.AsyncClient, "get", new=failing_get):
            self.assertEqual(
                await fx.ensure_rates(force_refresh=True), old_rates
            )

        self.assertTrue(fx.cache_is_stale())
        self.assertEqual(fx.cache_as_of(), "Thu, 31 Jul 2026 00:00:01 +0000")

    async def test_failed_initial_refresh_returns_503(self) -> None:
        async def failing_get(
            _client: httpx.AsyncClient,
            url: str,
            **_kwargs: object,
        ) -> httpx.Response:
            request = httpx.Request("GET", url)
            return httpx.Response(503, request=request)

        with patch.object(httpx.AsyncClient, "get", new=failing_get):
            with self.assertRaises(HTTPException) as raised:
                await fx.ensure_rates(force_refresh=True)

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("no last-known rates", raised.exception.detail)


class FxRouteTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.app = FastAPI()
        self.app.include_router(router)
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app),
            base_url="http://testserver",
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()

    async def test_rates_refresh_query_is_forwarded_and_not_cached_by_http(self) -> None:
        refresh_values: list[bool] = []

        async def fake_list_rates(*, force_refresh: bool = False) -> list[dict[str, object]]:
            refresh_values.append(force_refresh)
            return [{"code": "USD", "rate_to_usd": 1.0}]

        with (
            patch.object(
                fx,
                "list_rates_to_usd",
                new=fake_list_rates,
            ),
            patch.object(
                fx,
                "cache_metadata",
                return_value={
                    "as_of": "Thu, 07 Aug 2026 00:00:01 +0000",
                    "source": "open.er-api.com",
                    "stale": False,
                },
            ),
        ):
            response = await self.client.get(
                "/api/v1/fx/rates?base=USD&refresh=true"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(refresh_values, [True])
        self.assertEqual(response.json()["rates"][0]["rate_to_usd"], 1.0)
        self.assertIn("no-store", response.headers["cache-control"])

    async def test_single_rate_refresh_query_is_forwarded(self) -> None:
        refresh_values: list[bool] = []

        async def fake_ensure_rates(force_refresh: bool = False) -> dict[str, float]:
            refresh_values.append(force_refresh)
            return {"USD": 1.0, "COP": 4200.0}

        async def fake_get_rate(currency: str) -> float:
            self.assertEqual(currency, "COP")
            return 1 / 4200

        with (
            patch.object(fx, "ensure_rates", new=fake_ensure_rates),
            patch.object(fx, "get_rate_to_usd", new=fake_get_rate),
            patch.object(
                fx,
                "cache_metadata",
                return_value={
                    "as_of": "Thu, 07 Aug 2026 00:00:01 +0000",
                    "source": "open.er-api.com",
                    "stale": False,
                },
            ),
        ):
            response = await self.client.get(
                "/api/v1/fx/rate/COP?refresh=true"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(refresh_values, [True])
        self.assertAlmostEqual(response.json()["rate_to_usd"], 1 / 4200)
        self.assertIn("no-store", response.headers["cache-control"])


if __name__ == "__main__":
    unittest.main()

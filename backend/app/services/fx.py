"""Current FX rates with a short in-memory cache.

The public contract is ``rate_to_usd``: the USD value of one unit of the
target currency. Both providers return USD-base quotes as target-currency
units per 1 USD, so the service inverts those values for the API response.

ExchangeRate-API's no-key endpoint is the primary source because it provides a
broad table, including COP, and exposes an update timestamp. Frankfurter is a
fallback when the primary provider is unavailable.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from math import isfinite
from typing import Any

import httpx
from fastapi import HTTPException, status

PRIMARY_FX_URL = "https://open.er-api.com/v6/latest/USD"
FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"
CACHE_TTL_SECONDS = 15 * 60  # 15 minutes

REQUIRED_CURRENCIES = frozenset(
    {"USD", "EUR", "GBP", "CAD", "MXN", "COP", "BRL", "AUD", "JPY"}
)

_cache: dict[str, Any] = {
    "fetched_at": 0.0,
    "as_of": None,
    "source": None,
    "refresh_failed": False,
    "rates_from_usd": {},  # currency -> units per 1 USD
}


def _cache_fresh() -> bool:
    return bool(_cache["rates_from_usd"]) and (
        time.monotonic() - float(_cache["fetched_at"])
    ) < CACHE_TTL_SECONDS


def _parse_rates(data: Any) -> dict[str, float]:
    if not isinstance(data, dict):
        raise ValueError("FX provider returned an invalid response")

    raw_rates = data.get("rates")
    if not isinstance(raw_rates, dict):
        raise ValueError("FX provider returned no rate table")

    parsed: dict[str, float] = {}
    for raw_code, raw_value in raw_rates.items():
        if not isinstance(raw_code, str):
            continue
        code = raw_code.strip().upper()
        if not code:
            continue
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if value > 0 and isfinite(value):
            parsed[code] = value
    return parsed


def _provider_as_of(data: Any) -> str | None:
    if isinstance(data, dict):
        raw_updated = data.get("time_last_update_utc")
        if isinstance(raw_updated, str) and raw_updated.strip():
            return raw_updated.strip()

        raw_updated_unix = data.get("time_last_update_unix")
        if (
            isinstance(raw_updated_unix, (int, float))
            and not isinstance(raw_updated_unix, bool)
        ):
            try:
                return datetime.fromtimestamp(
                    raw_updated_unix, timezone.utc
                ).isoformat()
            except (OverflowError, OSError, TypeError, ValueError):
                pass

        raw_date = data.get("date")
        if isinstance(raw_date, str) and raw_date.strip():
            return raw_date.strip()
    return None


def _validate_provider_rates(rates: dict[str, float]) -> None:
    if not rates:
        raise ValueError("FX provider returned an empty rate table")

    missing = REQUIRED_CURRENCIES - {"USD"} - set(rates)
    if missing:
        missing_codes = ", ".join(sorted(missing))
        raise ValueError(
            f"FX provider did not return required currencies: {missing_codes}"
        )


def _rates_to_usd(rates: dict[str, float]) -> list[dict[str, float | str]]:
    """Invert provider USD-base quotes into the public API orientation."""
    out: list[dict[str, float | str]] = [{"code": "USD", "rate_to_usd": 1.0}]
    for code, units_per_usd in sorted(rates.items()):
        if code == "USD":
            continue
        value = float(units_per_usd)
        if value <= 0 or not isfinite(value):
            continue
        out.append({"code": code, "rate_to_usd": 1.0 / value})
    return out


async def _refresh_cache() -> None:
    providers = (
        ("open.er-api.com", PRIMARY_FX_URL, None),
        ("frankfurter", FRANKFURTER_URL, {"base": "USD"}),
    )
    last_error: Exception | None = None

    for source, url, params in providers:
        try:
            async with httpx.AsyncClient(
                timeout=15.0, follow_redirects=True
            ) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                rates = _parse_rates(data)
                rates["USD"] = 1.0
                _validate_provider_rates(rates)
                as_of = _provider_as_of(data)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue

        _cache["rates_from_usd"] = rates
        _cache["as_of"] = as_of
        _cache["source"] = source
        _cache["fetched_at"] = time.monotonic()
        _cache["refresh_failed"] = False
        return

    # Do not overwrite a successful cache with a failed or partial response.
    _cache["refresh_failed"] = True
    if _cache["rates_from_usd"]:
        return

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Unable to fetch current FX rates; no last-known rates are available.",
    ) from last_error


async def ensure_rates(force_refresh: bool = False) -> dict[str, float]:
    """Return provider rates (currency units per 1 USD), refreshing if needed."""
    if force_refresh or not _cache_fresh():
        await _refresh_cache()
    return dict(_cache["rates_from_usd"])


def cache_as_of() -> str:
    raw = _cache.get("as_of")
    if isinstance(raw, str) and raw:
        return raw
    return "unknown"


def cache_source() -> str:
    raw = _cache.get("source")
    if isinstance(raw, str) and raw:
        return raw
    return "unknown"


def cache_is_stale() -> bool:
    """Whether the response may be older than the normal cache policy."""
    return bool(_cache.get("refresh_failed")) or not _cache_fresh()


def cache_metadata() -> dict[str, str | bool]:
    return {
        "as_of": cache_as_of(),
        "source": cache_source(),
        "stale": cache_is_stale(),
    }


async def get_rate_to_usd(currency: str, force_refresh: bool = False) -> float:
    """
    USD value of 1 unit of `currency`.

    USD -> 1.0
    For others: invert the provider's USD-base quote.
    """
    code = (currency or "USD").strip().upper()
    if not code:
        code = "USD"
    if code == "USD":
        if force_refresh:
            await ensure_rates(force_refresh=True)
        return 1.0

    rates = await ensure_rates(force_refresh=force_refresh)
    if code not in rates:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No FX rate available for currency '{code}'.",
        )
    units_per_usd = float(rates[code])
    if units_per_usd <= 0 or not isfinite(units_per_usd):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Invalid zero FX rate for currency '{code}'.",
        )
    return 1.0 / units_per_usd


async def list_rates_to_usd(
    force_refresh: bool = False,
) -> list[dict[str, float | str]]:
    """All known currencies as {code, rate_to_usd}, including USD=1.0."""
    rates = await ensure_rates(force_refresh=force_refresh)
    return _rates_to_usd(rates)

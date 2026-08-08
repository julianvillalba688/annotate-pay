"""Current FX rates with a six-hour in-memory cache.

The public contract is ``rate_to_usd``: the USD value of one unit of the
target currency. Frankfurter's USD-base response has the opposite orientation
(target-currency units per USD), so the service inverts those values.

Frankfurter follows ECB currencies and does not currently publish COP. The
no-key secondary endpoint is used only to fill currencies missing from the
Frankfurter response, which keeps the required display currencies available
without storing a static or historical rate.
"""

from __future__ import annotations

import time
from datetime import date, datetime, timezone
from math import isfinite
from typing import Any

import httpx
from fastapi import HTTPException, status

FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"
CACHE_TTL_SECONDS = 6 * 60 * 60  # 6 hours
# Frankfurter currently omits COP. This endpoint is free and requires no key;
# it is only queried for currencies absent from the primary response.
SECONDARY_FX_URL = "https://open.er-api.com/v6/latest/USD"

REQUIRED_CURRENCIES = frozenset(
    {"USD", "EUR", "GBP", "CAD", "MXN", "COP", "BRL", "AUD", "JPY"}
)

_cache: dict[str, Any] = {
    "fetched_at": 0.0,
    "as_of": None,
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
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if value > 0 and isfinite(value):
            parsed[raw_code.strip().upper()] = value
    return parsed


def _provider_as_of(data: Any) -> str | None:
    if isinstance(data, dict):
        raw_date = data.get("date")
        if isinstance(raw_date, str) and raw_date:
            return raw_date

        raw_updated = data.get("time_last_update_utc")
        if isinstance(raw_updated, str) and raw_updated:
            try:
                return datetime.strptime(
                    raw_updated, "%a, %d %b %Y %H:%M:%S %z"
                ).date().isoformat()
            except ValueError:
                pass
    return None


async def _refresh_cache() -> None:
    primary_succeeded = False
    try:
        try:
            async with httpx.AsyncClient(
                timeout=15.0, follow_redirects=True
            ) as client:
                primary_response = await client.get(
                    FRANKFURTER_URL, params={"from": "USD"}
                )
                primary_response.raise_for_status()
                primary_data = primary_response.json()
                rates = _parse_rates(primary_data)
                as_of = _provider_as_of(primary_data)
                primary_succeeded = True

                missing = REQUIRED_CURRENCIES - {"USD"} - set(rates)
                if missing:
                    secondary_response = await client.get(SECONDARY_FX_URL)
                    secondary_response.raise_for_status()
                    secondary_data = secondary_response.json()
                    secondary_rates = _parse_rates(secondary_data)
                    for code in missing:
                        if code in secondary_rates:
                            rates[code] = secondary_rates[code]
                    if as_of is None:
                        as_of = _provider_as_of(secondary_data)

                if not rates or missing - set(rates):
                    missing_codes = ", ".join(sorted(missing - set(rates)))
                    raise ValueError(
                        f"FX provider did not return required currencies: {missing_codes}"
                    )
        except Exception:
            if primary_succeeded:
                raise
            # If Frankfurter is unavailable, the same no-key provider can still
            # supply a complete current table. A 503 is raised below only if
            # both providers fail or the result is incomplete.
            async with httpx.AsyncClient(
                timeout=15.0, follow_redirects=True
            ) as client:
                fallback_response = await client.get(SECONDARY_FX_URL)
                fallback_response.raise_for_status()
                fallback_data = fallback_response.json()
                rates = _parse_rates(fallback_data)
                as_of = _provider_as_of(fallback_data)
                missing = REQUIRED_CURRENCIES - {"USD"} - set(rates)
                if missing:
                    missing_codes = ", ".join(sorted(missing))
                    raise ValueError(
                        f"FX provider did not return required currencies: {missing_codes}"
                    )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch current FX rates from the configured providers.",
        ) from exc

    if not rates:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FX provider returned an empty rate table.",
        )

    _cache["rates_from_usd"] = rates
    _cache["as_of"] = as_of or date.today().isoformat()
    _cache["fetched_at"] = time.monotonic()


async def ensure_rates() -> dict[str, float]:
    """Return provider rates (currency units per 1 USD), refreshing if needed."""
    if not _cache_fresh():
        await _refresh_cache()
    return dict(_cache["rates_from_usd"])


def cache_as_of() -> str:
    raw = _cache.get("as_of")
    if isinstance(raw, str) and raw:
        return raw
    return datetime.now(timezone.utc).date().isoformat()


async def get_rate_to_usd(currency: str) -> float:
    """
    USD value of 1 unit of `currency`.

    USD -> 1.0
    For others: invert Frankfurter's from=USD quote.
    """
    code = (currency or "USD").strip().upper()
    if not code:
        code = "USD"
    if code == "USD":
        return 1.0

    rates = await ensure_rates()
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


async def list_rates_to_usd() -> list[dict[str, float | str]]:
    """All known currencies as {code, rate_to_usd}, including USD=1.0."""
    rates = await ensure_rates()
    out: list[dict[str, float | str]] = [{"code": "USD", "rate_to_usd": 1.0}]
    for code, units_per_usd in sorted(rates.items()):
        if code == "USD":
            continue
        if float(units_per_usd) <= 0 or not isfinite(float(units_per_usd)):
            continue
        out.append({"code": code, "rate_to_usd": 1.0 / float(units_per_usd)})
    return out

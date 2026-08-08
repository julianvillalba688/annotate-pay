"""Current FX rates with a quota-conscious in-memory cache.

The public contract is ``rate_to_usd``: the USD value of one unit of the
target currency. Providers return USD-base quotes as target-currency units per
1 USD, so the service inverts those values for the API response.

AllRatesToday is the authenticated primary when configured. The open
ExchangeRate-API endpoint and Frankfurter are fallbacks when it is absent or
unavailable.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from math import isfinite
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import get_settings

logger = logging.getLogger(__name__)

ALLRATES_URL = "https://allratestoday.com/api/v1/rates"
ALLRATES_SOURCE = "allratestoday.com"
PRIMARY_FX_URL = "https://open.er-api.com/v6/latest/USD"
FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"
CACHE_TTL_SECONDS = 60 * 60  # One hour by default to protect free-tier quotas.

REQUIRED_CURRENCY_CODES = (
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "MXN",
    "COP",
    "BRL",
    "AUD",
    "JPY",
)
ALLRATES_TARGETS = ",".join(REQUIRED_CURRENCY_CODES[1:])

REQUIRED_CURRENCIES = frozenset(REQUIRED_CURRENCY_CODES)

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
    ) < _cache_ttl_seconds()


def _cache_ttl_seconds() -> int:
    configured = getattr(get_settings(), "fx_cache_ttl_seconds", CACHE_TTL_SECONDS)
    try:
        ttl = int(configured)
    except (TypeError, ValueError):
        return CACHE_TTL_SECONDS
    return ttl if ttl > 0 else CACHE_TTL_SECONDS


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
            if isinstance(raw_value, bool):
                continue
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


def _parse_allrates_time(raw_time: Any) -> str:
    if not isinstance(raw_time, str) or not raw_time.strip():
        raise ValueError("AllRatesToday returned an invalid timestamp")

    timestamp = raw_time.strip()
    try:
        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("AllRatesToday returned an invalid timestamp") from exc
    return timestamp


def _parse_allrates_response(data: Any) -> tuple[dict[str, float], str]:
    """Validate and parse AllRatesToday's multi-target response."""
    if not isinstance(data, list):
        raise ValueError("AllRatesToday returned an invalid response")

    expected_targets = REQUIRED_CURRENCIES - {"USD"}
    parsed: dict[str, float] = {}
    as_of: str | None = None

    for row in data:
        if not isinstance(row, dict):
            raise ValueError("AllRatesToday returned an invalid rate row")

        raw_source = row.get("source")
        source = raw_source.strip().upper() if isinstance(raw_source, str) else ""
        if source != "USD":
            raise ValueError("AllRatesToday returned an invalid source currency")

        raw_target = row.get("target")
        target = raw_target.strip().upper() if isinstance(raw_target, str) else ""
        if target not in expected_targets:
            raise ValueError("AllRatesToday returned an invalid target currency")
        if target in parsed:
            raise ValueError("AllRatesToday returned a duplicate target currency")

        raw_rate = row.get("rate")
        if isinstance(raw_rate, bool):
            raise ValueError("AllRatesToday returned an invalid rate")
        try:
            rate = float(raw_rate)
        except (TypeError, ValueError) as exc:
            raise ValueError("AllRatesToday returned an invalid rate") from exc
        if rate <= 0 or not isfinite(rate):
            raise ValueError("AllRatesToday returned an invalid rate")

        timestamp = _parse_allrates_time(row.get("time"))
        if as_of is None:
            as_of = timestamp
        elif timestamp != as_of:
            raise ValueError("AllRatesToday returned inconsistent timestamps")

        parsed[target] = rate

    rates = {"USD": 1.0, **parsed}
    _validate_provider_rates(rates)
    if as_of is None:
        raise ValueError("AllRatesToday returned no timestamp")
    return rates, as_of


def _parse_allrates_rates(data: Any) -> dict[str, float]:
    """Return validated AllRatesToday provider quotes without conversion."""
    rates, _ = _parse_allrates_response(data)
    return rates


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


def _provider_failure_reason(
    response: httpx.Response | None, error: Exception
) -> str:
    if response is not None:
        if response.status_code == 401:
            return "authentication rejected"
        if response.status_code == 429:
            return "quota or rate limit exceeded"
        if response.status_code == 503:
            return "provider unavailable"
        if response.status_code >= 400:
            return f"http status {response.status_code}"
    if isinstance(error, httpx.TimeoutException):
        return "request timed out"
    if isinstance(error, httpx.RequestError):
        return "network request failed"
    if isinstance(error, ValueError):
        return "invalid provider response"
    return "request failed"


def _log_provider_failure(
    source: str, response: httpx.Response | None, error: Exception
) -> None:
    # Never include exception text: it could contain request details or headers.
    logger.warning(
        "FX provider %s failed (%s)",
        source,
        _provider_failure_reason(response, error),
    )


async def _refresh_cache() -> None:
    settings = get_settings()
    raw_api_key = getattr(settings, "allrates_api_key", "")
    api_key = raw_api_key.strip() if isinstance(raw_api_key, str) else ""

    providers: list[
        tuple[str, str, dict[str, str] | None, dict[str, str] | None]
    ] = []
    if api_key:
        providers.append(
            (
                ALLRATES_SOURCE,
                ALLRATES_URL,
                {"source": "USD", "target": ALLRATES_TARGETS},
                {"Authorization": f"Bearer {api_key}"},
            )
        )
    providers.extend(
        (
            ("open.er-api.com", PRIMARY_FX_URL, None, None),
            ("frankfurter", FRANKFURTER_URL, {"base": "USD"}, None),
        )
    )

    for source, url, params, headers in providers:
        response: httpx.Response | None = None
        try:
            async with httpx.AsyncClient(
                timeout=15.0, follow_redirects=True
            ) as client:
                request_kwargs: dict[str, Any] = {"params": params}
                if headers:
                    request_kwargs["headers"] = headers
                response = await client.get(url, **request_kwargs)
                if response.status_code >= 400:
                    response.raise_for_status()
                data = response.json()
                if source == ALLRATES_SOURCE:
                    rates, as_of = _parse_allrates_response(data)
                else:
                    rates = _parse_rates(data)
                    rates["USD"] = 1.0
                    _validate_provider_rates(rates)
                    as_of = _provider_as_of(data)
        except Exception as exc:  # noqa: BLE001
            _log_provider_failure(source, response, exc)
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
    ) from None


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
    """Validated currencies as {code, rate_to_usd}, including USD=1.0."""
    rates = await ensure_rates(force_refresh=force_refresh)
    return _rates_to_usd(rates)

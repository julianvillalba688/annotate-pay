"""Foreign-exchange rate endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.services import fx as fx_service

router = APIRouter(prefix="/api/v1/fx", tags=["fx"])


def _set_no_store_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"


@router.get("/rates")
async def list_fx_rates(
    response: Response,
    base: str = Query(default="USD", description="Quote base; only USD supported"),
    refresh: bool = Query(
        default=False,
        description="Bypass the in-memory cache and fetch provider rates",
    ),
) -> dict[str, object]:
    """
    List FX rates as USD value of 1 unit of each currency.

    `rate_to_usd` is the USD value of one unit of each target currency. To
    display a USD amount in a target currency, divide by that rate.
    """
    _set_no_store_headers(response)
    base_code = (base or "USD").strip().upper()
    if base_code != "USD":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only base=USD is supported because accounting is canonical USD.",
        )

    rates = await fx_service.list_rates_to_usd(force_refresh=refresh)
    metadata = fx_service.cache_metadata()
    return {
        "base": base_code,
        "as_of": metadata["as_of"],
        "rates": rates,
        "source": metadata["source"],
        "stale": metadata["stale"],
    }


@router.get("/rate/{currency}")
async def get_fx_rate(
    currency: str,
    response: Response,
    refresh: bool = Query(
        default=False,
        description="Bypass the in-memory cache and fetch provider rates",
    ),
) -> dict[str, object]:
    """Return ``rate_to_usd`` for one currency (USD value of 1 unit)."""
    _set_no_store_headers(response)
    code = currency.strip().upper()
    # USD is fixed and needs no provider call unless an explicit refresh was
    # requested. Other currencies need the provider table before conversion.
    if code != "USD" or refresh:
        await fx_service.ensure_rates(force_refresh=refresh)
    rate = await fx_service.get_rate_to_usd(code)
    metadata = fx_service.cache_metadata()
    return {
        "currency": code,
        "rate_to_usd": rate,
        "as_of": metadata["as_of"],
        "source": metadata["source"],
        "stale": metadata["stale"],
    }

"""Foreign-exchange rate endpoints (Frankfurter)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.services import fx as fx_service

router = APIRouter(prefix="/api/v1/fx", tags=["fx"])


@router.get("/rates")
async def list_fx_rates(
    base: str = Query(default="USD", description="Quote base; only USD supported"),
) -> dict[str, object]:
    """
    List FX rates as USD value of 1 unit of each currency.

    `rate_to_usd` is the USD value of one unit of each target currency. To
    display a USD amount in a target currency, divide by that rate.
    """
    base_code = (base or "USD").strip().upper()
    if base_code != "USD":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only base=USD is supported because accounting is canonical USD.",
        )

    rates = await fx_service.list_rates_to_usd()
    return {
        "base": base_code,
        "as_of": fx_service.cache_as_of(),
        "rates": rates,
    }


@router.get("/rate/{currency}")
async def get_fx_rate(currency: str) -> dict[str, object]:
    """Return ``rate_to_usd`` for one currency (USD value of 1 unit)."""
    code = currency.strip().upper()
    rate = await fx_service.get_rate_to_usd(code)
    return {
        "currency": code,
        "rate_to_usd": rate,
        "as_of": fx_service.cache_as_of(),
    }

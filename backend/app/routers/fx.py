"""
FX rate endpoint — Sprint 3.

  GET /api/v1/fx/rates?base=USD  — returns all exchange rates relative to base
"""
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.fx_service import get_rates, DISPLAY_CURRENCIES
from app.utils.redis import get_redis
from app.utils.response import success_response

router = APIRouter(prefix="/api/v1/fx", tags=["fx"])


@router.get("/rates")
async def exchange_rates(
    base: str = Query(default="USD", description="Base currency code, e.g. USD, EUR, GBP"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Return exchange rates with `base` as 1.0.
    Results are cached in Redis for 24 h.
    Falls back to approximate hardcoded rates when ECB is unreachable.
    """
    redis  = get_redis()
    rates  = await get_rates(base=base.upper(), redis=redis)

    # Only return the display subset + base currency
    filtered = {
        ccy: rate
        for ccy, rate in rates.items()
        if ccy in DISPLAY_CURRENCIES or ccy == base.upper()
    }

    return success_response(
        data={
            "base":       base.upper(),
            "rates":      filtered,
            "currencies": DISPLAY_CURRENCIES,
        },
        message="Exchange rates retrieved",
    )

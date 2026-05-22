"""
FX rate service — Sprint 3.

Fetches daily exchange rates from the ECB free XML feed (EUR-base).
Caches results in Redis for 24 h; falls back to hardcoded approximations
when ECB is unreachable.

All marketing metric values in the DB are stored in USD.
The `get_rates(base="USD")` helper returns a {currency: multiplier} dict
so the frontend can convert display values without extra API calls.
"""
import json
import logging
import xml.etree.ElementTree as ET
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

ECB_URL    = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
CACHE_KEY  = "fx:rates:eur"
CACHE_TTL  = 86_400  # 24 h

# ECB XML namespace map
_NS = {
    "gesmes": "http://www.gesmes.org/xml/2002-08-01",
    "ecb":    "http://www.ecb.int/vocabulary/2002-08-01/eurofxref",
}

# Approximate EUR-base fallback rates (updated 2025-Q1)
_FALLBACK_EUR: dict[str, float] = {
    "EUR": 1.0,
    "USD": 1.09, "GBP": 0.86, "JPY": 162.5, "CHF": 0.96,
    "CAD": 1.48, "AUD": 1.66, "NZD": 1.80, "SGD": 1.46,
    "HKD": 8.51, "CNY": 7.88, "INR": 90.5, "BRL": 5.42,
    "MXN": 18.7, "AED": 4.00, "SAR": 4.09, "KWD": 0.33,
    "ZAR": 19.8, "TRY": 34.9, "SEK": 11.4, "NOK": 11.7,
    "DKK": 7.46, "PLN": 4.29, "CZK": 25.3, "HUF": 403.0,
    "RON": 4.97, "BGN": 1.96,
}

# Supported display currencies (subset shown in UI selector)
DISPLAY_CURRENCIES = [
    "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD",
    "JPY", "CHF", "SGD", "INR", "BRL",
]


async def _fetch_ecb() -> Optional[dict[str, float]]:
    """Fetch and parse the ECB XML feed. Returns EUR-base rates or None."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(ECB_URL)
            resp.raise_for_status()

        root = ET.fromstring(resp.text)
        rates: dict[str, float] = {"EUR": 1.0}
        for cube in root.findall(".//ecb:Cube[@currency]", _NS):
            ccy  = cube.get("currency", "")
            rate = cube.get("rate", "")
            if ccy and rate:
                try:
                    rates[ccy] = float(rate)
                except ValueError:
                    pass

        if len(rates) > 10:
            logger.debug("ECB rates fetched: %d currencies", len(rates))
            return rates

    except Exception as exc:
        logger.warning("ECB fetch failed: %s", exc)
    return None


def _eur_to_base(eur_rates: dict[str, float], base: str) -> dict[str, float]:
    """
    Convert a EUR-base rate dict to a dict where `base` currency = 1.0.

    Formula: rate(base→X) = eur_rates[X] / eur_rates[base]
    """
    base_eur = eur_rates.get(base.upper(), 1.0)
    if base_eur == 0:
        base_eur = 1.0
    return {
        ccy: round(eur_rate / base_eur, 6)
        for ccy, eur_rate in eur_rates.items()
    }


async def get_rates(base: str = "USD", redis=None) -> dict[str, float]:
    """
    Return exchange rates with `base` as 1.0.
    Cached in Redis for 24 h; falls back to hardcoded approximations.
    """
    eur_rates: Optional[dict[str, float]] = None

    # ── Try Redis cache ───────────────────────────────────────────────────────
    if redis is not None:
        try:
            cached = await redis.get(CACHE_KEY)
            if cached:
                eur_rates = json.loads(cached)
        except Exception as exc:
            logger.debug("Redis get failed: %s", exc)

    # ── Fetch from ECB if not cached ──────────────────────────────────────────
    if eur_rates is None:
        eur_rates = await _fetch_ecb()
        if eur_rates and redis is not None:
            try:
                await redis.setex(CACHE_KEY, CACHE_TTL, json.dumps(eur_rates))
            except Exception as exc:
                logger.debug("Redis set failed: %s", exc)

    # ── Fallback ──────────────────────────────────────────────────────────────
    if eur_rates is None:
        logger.info("Using fallback FX rates")
        eur_rates = _FALLBACK_EUR

    return _eur_to_base(eur_rates, base.upper())

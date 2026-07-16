"""
Timezone policy for mediaERP — the product runs entirely on **IST**
(Indian Standard Time, Asia/Kolkata, UTC+05:30).

Rules
-----
* **Storage stays UTC.** Every timestamp persisted to MongoDB is a timezone-aware
  UTC instant. UTC is not "another timezone" — it is the unambiguous wire format
  for a point in time, and it keeps comparisons with external APIs (Google, Meta,
  Stripe) and Celery correct.
* **Every wall-clock decision is IST.** Anything a human reads, picks, or
  schedules ("send at 09:00", "today's tasks", "the 1st of the month") is
  interpreted in IST via the helpers below.

IST observes **no DST**, so a fixed +05:30 offset is exact for all dates. Using a
fixed offset (rather than zoneinfo) also avoids requiring the `tzdata` package on
Windows, where the IANA database is not bundled.
"""

from datetime import datetime, date, time, timedelta, timezone

# Indian Standard Time — UTC+05:30, no DST.
IST = timezone(timedelta(hours=5, minutes=30), name="IST")
IST_NAME = "Asia/Kolkata"


def utc_iso(v):
    """
    Serialize a datetime for the API with an explicit UTC offset.

    Motor returns timezone-**naive** datetimes that represent UTC. Emitting
    ``dt.isoformat()`` on those produces e.g. "2026-07-17T03:30:00" with no
    offset — which JavaScript parses as *local* time, so the frontend renders
    the wrong moment. Always send the offset so the IST formatters convert
    correctly.

    Non-datetime values (None, strings, dates) are returned unchanged.
    """
    if v is None or not isinstance(v, datetime):
        return v
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v.isoformat()


def now_ist() -> datetime:
    """Current moment as an IST-aware datetime."""
    return datetime.now(IST)


def now_utc() -> datetime:
    """Current moment as a UTC-aware datetime (what we persist)."""
    return datetime.now(timezone.utc)


def to_ist(dt: datetime | None) -> datetime | None:
    """Convert any datetime to IST. Naive values are assumed to be UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)


def to_utc(dt: datetime | None) -> datetime | None:
    """Convert any datetime to UTC. Naive values are assumed to be IST."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(timezone.utc)


def ist_wallclock_to_utc(
    year: int, month: int, day: int, hour: int = 0, minute: int = 0
) -> datetime:
    """Build an IST wall-clock moment and return it as a UTC instant."""
    return datetime(year, month, day, hour, minute, tzinfo=IST).astimezone(timezone.utc)


def today_ist() -> date:
    """Today's calendar date in IST."""
    return now_ist().date()


def ist_day_start_utc(d: date) -> datetime:
    """UTC instant of 00:00:00 IST on the given IST calendar date."""
    return datetime.combine(d, time.min, tzinfo=IST).astimezone(timezone.utc)


def ist_day_end_utc(d: date) -> datetime:
    """UTC instant of 23:59:59.999999 IST on the given IST calendar date."""
    return datetime.combine(d, time.max, tzinfo=IST).astimezone(timezone.utc)


def ist_period_start_utc(period: str) -> datetime | None:
    """
    Start of an IST calendar period, returned as a UTC instant.

    period: "today" | "this_week" (Mon-start) | "this_month" | "this_year"
    Returns None for an unknown period.
    """
    t = today_ist()
    if period == "today":
        start = t
    elif period == "this_week":
        start = t - timedelta(days=t.weekday())  # Monday of this IST week
    elif period == "this_month":
        start = t.replace(day=1)
    elif period == "this_year":
        start = t.replace(month=1, day=1)
    else:
        return None
    return ist_day_start_utc(start)

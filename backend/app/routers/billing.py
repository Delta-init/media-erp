"""
Billing & Stripe integration — Feature 5.
Manages subscription plans, Stripe checkout/portal sessions, and usage limits.
When STRIPE_SECRET_KEY is not set, the router operates in demo mode returning
mock data so the UI is fully functional without live Stripe credentials.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response
from app.utils.timezone import utc_iso

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

# ── Plan definitions ───────────────────────────────────────────────────────────

PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price_monthly": 0,
        "price_yearly": 0,
        "stripe_price_id_monthly": getattr(settings, "stripe_price_free_monthly", ""),
        "stripe_price_id_yearly":  getattr(settings, "stripe_price_free_yearly", ""),
        "limits": {
            "connectors": 2,
            "users": 1,
            "data_retention_days": 30,
            "scheduled_posts": 10,
            "clients": 0,
            "email_reports": 1,
            "rules": 3,
            "export": False,
            "white_label": False,
        },
        "features": [
            "2 platform connectors",
            "30-day data retention",
            "Basic reports",
            "10 scheduled posts/mo",
        ],
        "highlighted": False,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_monthly": 49,
        "price_yearly": 39,
        "stripe_price_id_monthly": getattr(settings, "stripe_price_pro_monthly", ""),
        "stripe_price_id_yearly":  getattr(settings, "stripe_price_pro_yearly", ""),
        "limits": {
            "connectors": 10,
            "users": 5,
            "data_retention_days": 90,
            "scheduled_posts": 200,
            "clients": 5,
            "email_reports": 10,
            "rules": 25,
            "export": True,
            "white_label": False,
        },
        "features": [
            "10 platform connectors",
            "90-day data retention",
            "Advanced analytics",
            "200 scheduled posts/mo",
            "PDF & Excel exports",
            "5 client workspaces",
            "25 automated rules",
        ],
        "highlighted": True,
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "price_monthly": 149,
        "price_yearly": 119,
        "stripe_price_id_monthly": getattr(settings, "stripe_price_enterprise_monthly", ""),
        "stripe_price_id_yearly":  getattr(settings, "stripe_price_enterprise_yearly", ""),
        "limits": {
            "connectors": -1,  # unlimited
            "users": -1,
            "data_retention_days": 365,
            "scheduled_posts": -1,
            "clients": -1,
            "email_reports": -1,
            "rules": -1,
            "export": True,
            "white_label": True,
        },
        "features": [
            "Unlimited connectors",
            "365-day data retention",
            "White-label reports",
            "Unlimited everything",
            "Priority support",
            "Custom integrations",
            "Agency client management",
        ],
        "highlighted": False,
    },
]

_PLAN_MAP = {p["id"]: p for p in PLANS}


def _stripe_available() -> bool:
    return bool(getattr(settings, "stripe_secret_key", ""))


def _get_stripe():
    if not _stripe_available():
        return None
    import stripe
    stripe.api_key = settings.stripe_secret_key  # type: ignore
    return stripe


# ── Schemas ────────────────────────────────────────────────────────────────────

class CheckoutCreate(BaseModel):
    plan_id: str
    billing_period: str = "monthly"  # "monthly" | "yearly"
    success_url: str = f"{settings.frontend_url}/billing?success=1"
    cancel_url: str  = f"{settings.frontend_url}/billing"


class PortalCreate(BaseModel):
    return_url: str = f"{settings.frontend_url}/billing"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize_sub(doc: dict) -> dict:
    def _dt(v): return utc_iso(v)
    return {
        "id": str(doc["_id"]),
        "plan": doc.get("plan", "free"),
        "status": doc.get("status", "active"),
        "billing_period": doc.get("billing_period", "monthly"),
        "current_period_end": _dt(doc.get("current_period_end")),
        "stripe_customer_id": doc.get("stripe_customer_id"),
        "stripe_subscription_id": doc.get("stripe_subscription_id"),
        "cancel_at_period_end": doc.get("cancel_at_period_end", False),
        "created_at": _dt(doc.get("created_at")),
        "updated_at": _dt(doc.get("updated_at")),
    }


async def _get_or_create_sub(db: AsyncIOMotorDatabase, user_id: str) -> dict:
    """Return existing subscription doc or create a free-tier default."""
    doc = await db["subscriptions"].find_one({"user_id": user_id})
    if doc:
        return doc
    now = datetime.now(timezone.utc)
    new_doc = {
        "user_id": user_id,
        "plan": "free",
        "status": "active",
        "billing_period": "monthly",
        "current_period_end": None,
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "cancel_at_period_end": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["subscriptions"].insert_one(new_doc)
    new_doc["_id"] = result.inserted_id
    return new_doc


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/plans", summary="List all available subscription plans")
async def list_plans():
    return success_response(data=PLANS, message="Plans retrieved")


@router.get("/subscription", summary="Get current user subscription")
async def get_subscription(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    sub = await _get_or_create_sub(db, user_id)

    # Also return plan limits
    plan_def = _PLAN_MAP.get(sub.get("plan", "free"), PLANS[0])

    return success_response(
        data={
            "subscription": _serialize_sub(sub),
            "plan": plan_def,
            "stripe_available": _stripe_available(),
        },
        message="Subscription retrieved",
    )


@router.get("/usage", summary="Get current usage vs plan limits")
async def get_usage(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    sub = await _get_or_create_sub(db, user_id)
    plan_def = _PLAN_MAP.get(sub.get("plan", "free"), PLANS[0])
    limits = plan_def["limits"]

    # Count actual usage
    connector_count  = await db["connectors"].count_documents({"user_id": user_id})
    user_count       = await db["users"].count_documents({"agency_id": user_id})
    rule_count       = await db["rules"].count_documents({"user_id": user_id})
    report_count     = await db["email_schedules"].count_documents({"user_id": user_id})
    client_count     = await db["clients"].count_documents({"agency_user_id": user_id})

    # Posts this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    post_count = await db["scheduled_posts"].count_documents({
        "user_id": user_id,
        "created_at": {"$gte": month_start},
    })

    def _pct(used, limit):
        if limit == -1: return 0  # unlimited
        if limit == 0: return 100
        return min(round((used / limit) * 100), 100)

    usage = {
        "connectors":    {"used": connector_count, "limit": limits["connectors"],     "pct": _pct(connector_count, limits["connectors"])},
        "users":         {"used": user_count,       "limit": limits["users"],          "pct": _pct(user_count, limits["users"])},
        "rules":         {"used": rule_count,        "limit": limits["rules"],         "pct": _pct(rule_count, limits["rules"])},
        "email_reports": {"used": report_count,      "limit": limits["email_reports"], "pct": _pct(report_count, limits["email_reports"])},
        "clients":       {"used": client_count,      "limit": limits["clients"],       "pct": _pct(client_count, limits["clients"])},
        "scheduled_posts": {"used": post_count,      "limit": limits["scheduled_posts"], "pct": _pct(post_count, limits["scheduled_posts"])},
    }

    return success_response(
        data={"usage": usage, "plan": plan_def["id"], "features": limits},
        message="Usage retrieved",
    )


@router.post("/create-checkout", summary="Create Stripe checkout session")
async def create_checkout(
    body: CheckoutCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not _stripe_available():
        return success_response(
            data={"demo_mode": True, "message": "Stripe not configured — set STRIPE_SECRET_KEY in .env"},
            message="Demo mode: Stripe not configured",
        )

    stripe = _get_stripe()
    user_id = str(current_user["_id"])
    sub = await _get_or_create_sub(db, user_id)

    plan_def = _PLAN_MAP.get(body.plan_id)
    if not plan_def:
        return error_response(message="Invalid plan", status_code=422)

    price_id = (
        plan_def["stripe_price_id_yearly"]
        if body.billing_period == "yearly"
        else plan_def["stripe_price_id_monthly"]
    )
    if not price_id:
        return error_response(message="Stripe price ID not configured for this plan", status_code=422)

    # Get or create Stripe customer
    customer_id = sub.get("stripe_customer_id")
    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.get("email", ""),
            name=current_user.get("name", ""),
            metadata={"user_id": user_id},
        )
        customer_id = customer.id
        await db["subscriptions"].update_one(
            {"user_id": user_id},
            {"$set": {"stripe_customer_id": customer_id}},
        )

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"user_id": user_id, "plan_id": body.plan_id},
    )

    return success_response(data={"checkout_url": session.url}, message="Checkout session created")


@router.post("/create-portal", summary="Create Stripe billing portal session")
async def create_portal(
    body: PortalCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not _stripe_available():
        return success_response(
            data={"demo_mode": True},
            message="Demo mode: Stripe not configured",
        )

    stripe = _get_stripe()
    user_id = str(current_user["_id"])
    sub = await _get_or_create_sub(db, user_id)
    customer_id = sub.get("stripe_customer_id")
    if not customer_id:
        return error_response(message="No Stripe customer found. Subscribe first.", status_code=404)

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=body.return_url,
    )
    return success_response(data={"portal_url": session.url}, message="Portal session created")


@router.post("/webhook", summary="Stripe webhook endpoint", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _stripe_available():
        return {"received": True}

    stripe = _get_stripe()
    webhook_secret = getattr(settings, "stripe_webhook_secret", "")
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, webhook_secret)
    except Exception as exc:
        logger.warning("Stripe webhook verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        plan_id = session.get("metadata", {}).get("plan_id", "pro")
        if user_id:
            await db["subscriptions"].update_one(
                {"user_id": user_id},
                {"$set": {
                    "plan": plan_id,
                    "status": "active",
                    "stripe_subscription_id": session.get("subscription"),
                    "updated_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
            # Mirror plan on user doc
            await db["users"].update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"plan": plan_id}},
            )

    elif event["type"] in ("customer.subscription.updated", "customer.subscription.deleted"):
        sub_obj = event["data"]["object"]
        customer_id = sub_obj.get("customer")
        sub_doc = await db["subscriptions"].find_one({"stripe_customer_id": customer_id})
        if sub_doc:
            status = "cancelled" if event["type"].endswith("deleted") else sub_obj.get("status", "active")
            plan_id = sub_doc.get("plan", "free")
            if status == "cancelled":
                plan_id = "free"
            period_end = None
            if sub_obj.get("current_period_end"):
                period_end = datetime.fromtimestamp(sub_obj["current_period_end"], tz=timezone.utc)
            await db["subscriptions"].update_one(
                {"_id": sub_doc["_id"]},
                {"$set": {
                    "status": status,
                    "plan": plan_id,
                    "cancel_at_period_end": sub_obj.get("cancel_at_period_end", False),
                    "current_period_end": period_end,
                    "updated_at": datetime.now(timezone.utc),
                }},
            )

    return {"received": True}

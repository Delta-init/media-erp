# 🤖 Backend Agent Rules & Behavior — Supermetrics Clone

> Read this file completely before touching any backend file. All rules are mandatory.
> Stack: Python 3.12 · FastAPI · Motor (async MongoDB) · Celery + Redis · JWT · Pydantic v2 · pytest · Beanie ODM (optional)

---

## ⚡ MANDATORY RESPONSE PROTOCOL — No Exceptions

Every prompt asking for a code change MUST follow this 5-step sequence.

### Step 1 — Pre-Change Summary (BEFORE any code)

```
## 📋 Change Summary

**What I understood:**
→ [short description]

**What I plan to change:**
- File: `backend/app/path/file.py` — [what + why]

**Endpoints / services involved:**
- Router: METHOD /api/v1/path
- Service method: ServiceClass.method_name()

**Models / collections involved:**
- Collection: [collection name + relevant fields]

**Anything I'm NOT sure about:**
1. [question if ambiguous]

---
✅ Confirm to proceed — or clarify above.
```

### Step 2 — Wait for Confirmation
Do NOT write any code until the user says "yes", "proceed", "go", "ok" etc.

### Step 3 — Write the Code

Only after confirmation. Always check in this order:
1. `backend/mistakes.md` — not repeating a known bug
2. `backend/servicesHistory.md` — method already exists?
3. `backend/middlewareHistory.md` — correct middleware/dependency chain?
4. Write the code
5. Update relevant `.md` files

### Step 4 — Sub-Agent Testing (MANDATORY after every code change)

Run exactly 4 test cases using pytest:

| Case | What to test |
|------|-------------|
| Case 1 — Happy Path | Valid input, normal usage — feature works as intended |
| Case 2 — Edge / Boundary | Empty results, zero values, single item, max pagination |
| Case 3 — Error / Invalid Input | Missing fields, bad ObjectIds, wrong types, non-existent resources |
| Case 4 — Permission / Auth | No token (401), expired token (401), wrong plan tier (403) |

**Test Report Format:**
```
## 🧪 Test Report — [Feature]
| Case | Description | Result | Notes |
|------|-------------|--------|-------|
| Case 1 | [tested] | ✅ PASS / ❌ FAIL | |
| Case 2 | [tested] | ✅ PASS / ❌ FAIL | |
| Case 3 | [tested] | ✅ PASS / ❌ FAIL | |
| Case 4 | [tested] | ✅ PASS / ❌ FAIL | |

**Failures:** [root cause + fix applied + logged in mistakes.md]
```

If any case fails → fix immediately → re-run all 4 → log in `mistakes.md`.

### Step 5 — Verification (MANDATORY before any final response)

Before sending the post-change report, **verify once** that the tests were actually executed and passed — never claim ✅ PASS from intent alone.

```
## 🔎 Verification
- [ ] pytest command was actually run (not just written)
- [ ] All 4 test cases produced real output, not assumed
- [ ] Failures (if any) were re-tested after the fix
- [ ] Affected `.md` history files were updated and re-read
- [ ] Endpoint responses were checked against `success_response()` contract
```

If any box is unchecked → do NOT send the response. Re-run, then verify again.

### Step 6 — Post-Change Report
```
## ✅ Done
**Changed:** [files]
**Docs updated:** [which .md files]
**Tests:** Case 1 ✅ | Case 2 ✅ | Case 3 ✅ | Case 4 ✅
**Verified:** Yes — all checks passed once
```

**Skip Steps 1–2 only for:** typo fixes and read-only tasks (explain/search/summarise).
**Step 5 (Verification) is NEVER skipped** when code was written.

---

## 🧠 Agent Identity

You are a senior backend engineer specialising in:
- **FastAPI** (async routers, dependency injection, Pydantic v2 schemas)
- **MongoDB + Motor** (async driver, aggregation pipelines, indexes)
- **Celery + Redis** (distributed task queue, periodic scheduling with Celery Beat)
- **JWT Auth** (access tokens 15m + refresh tokens 7d, bcrypt hashing)
- **OAuth2** (PKCE flow for Google Ads, GA4, Facebook, LinkedIn, TikTok)
- **Python async/await** (no blocking I/O anywhere in the request path)
- **pytest + httpx** (async test client, 4-case coverage always)

---

## 📚 Memory & Learning System

| File | Purpose | Check When |
|------|---------|------------|
| `backend/agents.md` | This file — all rules | Before every backend task |
| `backend/mistakes.md` | Every bug found + fix | Before writing similar code |
| `backend/servicesHistory.md` | All service class methods | Before creating any service method |
| `backend/middlewareHistory.md` | Dependency chain + auth pattern | Before adding any route |
| `backend/features.md` | All backend features + endpoints | Before building any feature |

**Workflow — before writing any code:**
```
1. Read mistakes.md          → about to repeat a known bug?
2. Read servicesHistory.md   → does this service method already exist?
3. Read middlewareHistory.md → correct dependency injection chain?
4. Read features.md          → is this endpoint already built?
5. Write the code
6. Update the relevant .md files
```
Skipping this workflow is not allowed.

---

## 🗂 Project File Structure

```
backend/
├── app/
│   ├── main.py                 ← FastAPI app, CORS, router registration, lifespan
│   ├── config.py               ← Pydantic Settings from .env
│   ├── database.py             ← Motor async client + db + collection getters
│   ├── models/
│   │   ├── user.py             ← User document model
│   │   ├── connector.py        ← Connector document model
│   │   ├── marketing_data.py   ← Unified marketing data model
│   │   └── report.py           ← Saved report model
│   ├── routers/                ← Thin HTTP handlers: validate → call service → respond
│   │   ├── auth.py
│   │   ├── connectors.py
│   │   ├── sync.py
│   │   ├── reports.py
│   │   └── ai.py
│   ├── services/               ← All business logic here, never in routers
│   │   ├── auth_service.py
│   │   ├── connector_service.py
│   │   ├── report_service.py
│   │   ├── ai_service.py
│   │   ├── platforms/
│   │   │   ├── google_ads.py
│   │   │   ├── ga4.py
│   │   │   ├── facebook_ads.py
│   │   │   ├── linkedin.py
│   │   │   └── tiktok.py
│   │   └── sync_service.py
│   ├── tasks/
│   │   ├── celery_app.py       ← Celery + Redis config + Beat schedule
│   │   └── sync_tasks.py       ← @shared_task functions
│   ├── middleware/
│   │   ├── auth.py             ← get_current_user() FastAPI dependency
│   │   └── permissions.py      ← require_plan() dependency
│   ├── schemas/                ← Pydantic v2 request/response models
│   │   ├── auth.py
│   │   ├── connector.py
│   │   ├── report.py
│   │   └── ai.py
│   └── utils/
│       ├── response.py         ← success_response() / error_response()
│       ├── oauth.py            ← OAuth2 PKCE helpers per platform
│       └── encryption.py       ← AES-256-GCM encrypt/decrypt for tokens
├── tests/
│   ├── conftest.py             ← pytest fixtures — async client, test DB, factories
│   ├── helpers/
│   │   ├── auth.py             ← get_token(), make_headers()
│   │   └── factory.py          ← create_test_user(), create_test_connector()
│   ├── test_auth.py
│   ├── test_connectors.py
│   ├── test_reports.py
│   ├── test_sync.py
│   └── test_ai.py
├── mistakes.md
├── servicesHistory.md
├── middlewareHistory.md
├── features.md
├── requirements.txt
├── Dockerfile
└── .env
```

---

## 🔧 Core Conventions

### Response Helpers — Always Use, Never `return {}` Directly

```python
# utils/response.py
from fastapi.responses import JSONResponse

def success_response(data=None, message: str = "Success", status: int = 200):
    return JSONResponse(
        status_code=status,
        content={"success": True, "message": message, "data": data}
    )

def error_response(message: str, status: int = 400):
    return JSONResponse(
        status_code=status,
        content={"success": False, "message": message, "data": None}
    )
```

```python
# ❌ Never
return {"data": connectors, "success": True}

# ✅ Always
return success_response(data=connectors, message="Connectors fetched")
```

### Routers — Thin, Business Logic Goes in Services
```python
# ✅ Router is just: validate → call service → respond
@router.get("/")
async def list_connectors(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    connectors = await connector_service.get_user_connectors(db, current_user["_id"])
    return success_response(data=connectors)

# ❌ Never put MongoDB queries directly in a router
@router.get("/")
async def list_connectors(db=Depends(get_db)):
    connectors = await db.connectors.find({"user_id": ...}).to_list(100)  # BAD
    return {"data": connectors}
```

### Dependency Injection Chain
```python
# Standard protected route
@router.get("/")
async def endpoint(
    current_user: dict = Depends(get_current_user),   # validates JWT → injects user
    db=Depends(get_db),                                # injects Motor db
):

# Plan-restricted route
@router.post("/custom")
async def custom_report(
    current_user: dict = Depends(require_plan("pro")), # 403 if plan != pro/enterprise
    db=Depends(get_db),
):
```

### `middleware/auth.py`
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.jwt import decode_access_token

bearer = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db=Depends(get_db),
) -> dict:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

### Route Ordering — Static Before Parameterised
```python
# ✅ CORRECT — static routes first
router.get("/status")(get_sync_status)        # GET /sync/status
router.post("/trigger/{connector_id}")(...)   # POST /sync/trigger/:id  ← last

# ❌ WRONG — /:id catches /status
router.get("/{connector_id}")(...)            # catches /status too
router.get("/status")(...)                   # never reached
```

---

## 🗄 MongoDB Rules

### Always Use Async Motor — No Blocking Calls
```python
# ❌ WRONG — PyMongo blocking
users = db.users.find({"email": email})

# ✅ CORRECT — Motor async
users = await db.users.find({"email": email}).to_list(length=100)
```

### ObjectId Handling
```python
from bson import ObjectId

# ❌ WRONG — string comparison against ObjectId
await db.connectors.find_one({"user_id": user_id_str})

# ✅ CORRECT — always cast to ObjectId
await db.connectors.find_one({"user_id": ObjectId(user_id_str)})

# When returning to frontend — always convert _id to string
def serialize_doc(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    if "user_id" in doc:
        doc["user_id"] = str(doc["user_id"])
    return doc
```

### Aggregation Pipelines for Reports
```python
# Always use pipelines for report aggregations — never Python-side aggregation
pipeline = [
    {"$match": {
        "user_id": ObjectId(user_id),
        "date": {"$gte": date_from, "$lte": date_to},
        **({"platform": platform} if platform else {}),
    }},
    {"$group": {
        "_id": "$platform",
        "total_spend":       {"$sum": "$metrics.spend"},
        "total_clicks":      {"$sum": "$metrics.clicks"},
        "total_impressions": {"$sum": "$metrics.impressions"},
        "total_conversions": {"$sum": "$metrics.conversions"},
    }},
    {"$sort": {"total_spend": -1}},
]
result = await db.marketing_data.aggregate(pipeline).to_list(length=None)
```

### Indexes — Define in `database.py` on Startup
```python
async def create_indexes(db):
    await db.connectors.create_index([("user_id", 1)])
    await db.connectors.create_index([("user_id", 1), ("platform", 1)], unique=True)
    await db.marketing_data.create_index([("user_id", 1), ("date", -1)])
    await db.marketing_data.create_index([("user_id", 1), ("platform", 1), ("date", -1)])
    await db.marketing_data.create_index(
        [("user_id", 1), ("platform", 1), ("date", 1), ("campaign_id", 1)],
        unique=True,
        name="unique_data_point"
    )
```

### Upsert for Sync Data — Never Duplicate
```python
# When syncing — always upsert, never insert blindly
await db.marketing_data.update_one(
    {
        "user_id":     ObjectId(user_id),
        "platform":    platform,
        "date":        date,
        "campaign_id": campaign_id,
    },
    {"$set": {**metrics_data, "synced_at": datetime.utcnow()}},
    upsert=True,
)
```

### Pagination Pattern
```python
async def get_campaigns(db, user_id: str, platform: str | None, page: int = 1, limit: int = 50):
    query = {"user_id": ObjectId(user_id)}
    if platform:
        query["platform"] = platform
    skip = (page - 1) * limit
    total = await db.marketing_data.count_documents(query)
    docs = await db.marketing_data.find(query).skip(skip).limit(limit).to_list(length=limit)
    return {
        "items": [serialize_doc(d) for d in docs],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }
```

---

## 🔐 Auth & JWT

### JWT Utilities — `utils/jwt.py`
```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.config import settings

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "refresh"}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
```

### Password Hashing
```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

---

## 🔑 OAuth2 Flow — Per Platform

### Standard OAuth2 Flow Pattern
```python
# routers/connectors.py

@router.get("/{platform}/auth")
async def oauth_start(platform: str, current_user=Depends(get_current_user)):
    """Redirect user to platform OAuth consent screen."""
    auth_url = oauth_service.get_auth_url(platform, state=str(current_user["_id"]))
    return RedirectResponse(url=auth_url)

@router.get("/{platform}/callback")
async def oauth_callback(platform: str, code: str, state: str, db=Depends(get_db)):
    """Exchange code for tokens, store encrypted, redirect to frontend."""
    user_id = state  # extracted from state parameter
    tokens = await oauth_service.exchange_code(platform, code)
    await connector_service.save_tokens(db, user_id, platform, tokens)
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/connectors?connected={platform}")
```

### Token Encryption — `utils/encryption.py`
```python
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def encrypt_token(token: str, key: bytes) -> str:
    """AES-256-GCM encrypt. Returns hex(nonce + ciphertext)."""
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, token.encode(), None)
    return (nonce + ct).hex()

def decrypt_token(encrypted_hex: str, key: bytes) -> str:
    """Decrypt AES-256-GCM. Returns plaintext token."""
    data = bytes.fromhex(encrypted_hex)
    nonce, ct = data[:12], data[12:]
    return AESGCM(key).decrypt(nonce, ct, None).decode()
```

---

## ⚙ Celery + Redis Rules

### Celery App — `tasks/celery_app.py`
```python
from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "supermetrics",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.sync_tasks"],
)

celery_app.conf.beat_schedule = {
    "hourly-sync": {
        "task": "app.tasks.sync_tasks.run_scheduled_syncs",
        "schedule": crontab(minute=0),  # every hour
    },
}

celery_app.conf.timezone = "UTC"
```

### Sync Task Pattern — `tasks/sync_tasks.py`
```python
from app.tasks.celery_app import celery_app
from app.database import get_sync_db  # sync Motor wrapper for Celery context

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def sync_connector(self, connector_id: str):
    """Pull data from platform API and upsert to marketing_data."""
    try:
        db = get_sync_db()
        connector = db.connectors.find_one({"_id": ObjectId(connector_id)})
        if not connector:
            return {"error": "Connector not found"}

        # Update status → syncing
        db.connectors.update_one({"_id": ObjectId(connector_id)}, {"$set": {"status": "syncing"}})

        # Pull data from platform
        platform = connector["platform"]
        service = get_platform_service(platform)
        data = service.fetch_data(connector)

        # Upsert to marketing_data
        for row in data:
            db.marketing_data.update_one(
                {"user_id": connector["user_id"], "platform": platform,
                 "date": row["date"], "campaign_id": row["campaign_id"]},
                {"$set": {**row, "synced_at": datetime.utcnow()}},
                upsert=True,
            )

        # Update status → connected + last_synced
        db.connectors.update_one(
            {"_id": ObjectId(connector_id)},
            {"$set": {"status": "connected", "last_synced": datetime.utcnow(), "error_message": None}}
        )
    except Exception as exc:
        db.connectors.update_one(
            {"_id": ObjectId(connector_id)},
            {"$set": {"status": "error", "error_message": str(exc)}}
        )
        raise self.retry(exc=exc)

@celery_app.task
def run_scheduled_syncs():
    """Dispatch sync_connector for all active connectors due for sync."""
    db = get_sync_db()
    connectors = list(db.connectors.find({"status": "connected"}))
    for c in connectors:
        sync_connector.delay(str(c["_id"]))
```

---

## 🤖 Claude AI Integration — `services/ai_service.py`

```python
import anthropic
from app.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

MARKETING_DATA_SCHEMA = """
Collection: marketing_data
Fields: user_id (ObjectId), platform (str), date (str YYYY-MM-DD),
        campaign_id (str), campaign_name (str),
        metrics.impressions (int), metrics.clicks (int), metrics.spend (float),
        metrics.conversions (int), metrics.revenue (float),
        metrics.ctr (float), metrics.cpc (float), metrics.roas (float),
        dimensions.device (str), dimensions.country (str), dimensions.currency (str)
"""

async def query_with_ai(user_id: str, question: str, db) -> dict:
    """Convert NL question → MongoDB pipeline → execute → return result + explanation."""

    # Step 1: Ask Claude for aggregation pipeline
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": f"""You are a marketing data analyst. You have access to a MongoDB collection with this schema:

{MARKETING_DATA_SCHEMA}

The user_id to filter by is: {user_id}

Generate a valid MongoDB aggregation pipeline as a JSON array to answer this question:
"{question}"

Rules:
- Always include {{"$match": {{"user_id": {{"$oid": "{user_id}"}}}}}} as first stage
- Return ONLY valid JSON array, no explanation, no markdown
- Use $group, $sort, $limit appropriately
- All dates are strings in YYYY-MM-DD format"""
        }]
    )

    pipeline_json = message.content[0].text.strip()

    # Step 2: Execute pipeline
    import json
    pipeline = json.loads(pipeline_json)
    # Convert string ObjectIds in pipeline
    from bson import ObjectId
    pipeline[0]["$match"]["user_id"] = ObjectId(user_id)
    result = await db.marketing_data.aggregate(pipeline).to_list(length=100)

    # Step 3: Ask Claude to explain result
    explanation_msg = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": f'Question: "{question}"\nData result: {result}\n\nExplain this result in 2-3 sentences for a non-technical marketing manager.'
        }]
    )

    return {
        "question": question,
        "pipeline": pipeline,
        "result": [serialize_doc(r) for r in result],
        "explanation": explanation_msg.content[0].text,
    }
```

---

## 🧪 Testing Rules

### Test File Setup — `tests/conftest.py`
```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db
from motor.motor_asyncio import AsyncIOMotorClient

TEST_DB_URL = "mongodb://localhost:27017/supermetrics_test"

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(TEST_DB_URL)
    db = client.supermetrics_test
    yield db
    # Cleanup after each test
    await client.drop_database("supermetrics_test")
    client.close()
```

### Auth Helpers — `tests/helpers/auth.py`
```python
async def get_token(client, email="test@example.com", password="Test1234!") -> str:
    # Register if needed
    await client.post("/api/v1/auth/register", json={"email": email, "name": "Test", "password": password})
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return r.json()["data"]["access_token"]

def make_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
```

### 4-Case Test Template
```python
import pytest
from tests.helpers.auth import get_token, make_headers

@pytest.mark.asyncio
class TestConnectors:
    async def test_case1_happy_path(self, client, db):
        token = await get_token(client)
        r = await client.get("/api/v1/connectors", headers=make_headers(token))
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert isinstance(r.json()["data"], list)

    async def test_case2_edge_empty(self, client, db):
        """User with no connectors returns empty list not 404."""
        token = await get_token(client)
        r = await client.get("/api/v1/connectors", headers=make_headers(token))
        assert r.status_code == 200
        assert r.json()["data"] == []

    async def test_case3_invalid_id(self, client, db):
        """Bad connector ID returns 404 or 400."""
        token = await get_token(client)
        r = await client.get("/api/v1/connectors/not-a-valid-id", headers=make_headers(token))
        assert r.status_code in [400, 404]
        assert r.json()["success"] is False

    async def test_case4_no_auth(self, client, db):
        """Missing token returns 401."""
        r = await client.get("/api/v1/connectors")
        assert r.status_code == 401
```

---

## 📦 Requirements

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
motor>=3.5.0
pymongo>=4.8.0
pydantic>=2.8.0
pydantic-settings>=2.4.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-dotenv>=1.0.0
celery>=5.4.0
redis>=5.0.0
anthropic>=0.34.0
cryptography>=43.0.0
httpx>=0.27.0
pytest>=8.3.0
pytest-asyncio>=0.23.0

# Platform API clients
google-ads>=24.0.0
google-analytics-data>=0.18.0
facebook-business>=20.0.0
```

---

## ⚠ Common Mistakes — Check `mistakes.md` Before Writing Similar Code

Known patterns that have caused bugs in this type of project:

1. **ObjectId not cast** — always `ObjectId(user_id_str)` in queries, never raw string
2. **Blocking Motor calls** — always `await`, never sync PyMongo in async context
3. **OAuth state tampering** — validate `state` parameter in callback matches a stored nonce
4. **Celery serialisation** — pass only primitive types (str, int) to `.delay()`, never ObjectId or datetime
5. **Token refresh race** — only issue new access token if refresh token signature AND expiry are valid
6. **Duplicate sync inserts** — always upsert with compound unique key, never `insert_many` raw
7. **Pipeline user_id type** — in aggregation `$match`, `user_id` must be `ObjectId`, not string
8. **Missing indexes** — `marketing_data` queries without indexes will time out at scale

Log every new bug immediately in `backend/mistakes.md`.

---

## 🌐 All API Endpoints Reference

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
POST   /api/v1/auth/logout
PUT    /api/v1/auth/me
PUT    /api/v1/auth/password

GET    /api/v1/connectors
POST   /api/v1/connectors
GET    /api/v1/connectors/:id
PUT    /api/v1/connectors/:id
DELETE /api/v1/connectors/:id
GET    /api/v1/connectors/:platform/auth        ← OAuth start → redirect
GET    /api/v1/connectors/:platform/callback    ← OAuth callback → store tokens

POST   /api/v1/sync/trigger/:connector_id
GET    /api/v1/sync/status
GET    /api/v1/sync/history/:connector_id

GET    /api/v1/reports/overview
GET    /api/v1/reports/campaigns
GET    /api/v1/reports/trend
POST   /api/v1/reports/custom
GET    /api/v1/reports/saved
POST   /api/v1/reports/saved
GET    /api/v1/reports/saved/:id
DELETE /api/v1/reports/saved/:id
GET    /api/v1/reports/export

POST   /api/v1/ai/query
GET    /api/v1/ai/history
```

---

## 📝 File References

| File | Read When |
|------|-----------|
| `backend/agents.md` | Every backend task — this file |
| `backend/mistakes.md` | Before writing similar code to a past bug |
| `backend/servicesHistory.md` | Before creating any service method |
| `backend/middlewareHistory.md` | Before adding any route or dependency |
| `backend/features.md` | Before building any feature or endpoint |

"""One-shot script: create / reset testadmin@mediaerp.com with a known password."""
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from passlib.context import CryptContext
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGODB_DB_NAME", "mediaerp")

client = MongoClient(MONGO_URL)
db     = client[DB_NAME]

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed  = pwd_ctx.hash("Test@1234")

result = db.users.update_one(
    {"email": "testadmin@mediaerp.com"},
    {
        "$set": {
            "email":           "testadmin@mediaerp.com",
            "hashed_password": hashed,
            "name":            "Test Admin",
            "role":            "admin",
            "plan":            "enterprise",
            "is_active":       True,
            "created_at":      datetime.now(timezone.utc),
        }
    },
    upsert=True,
)
print(f"matched={result.matched_count} modified={result.modified_count} upserted={result.upserted_id}")
print("Test user ready → email: testadmin@mediaerp.com  password: Test@1234")

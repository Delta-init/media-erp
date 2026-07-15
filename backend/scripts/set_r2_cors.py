"""
Configure the R2 bucket CORS policy so browsers may upload directly via
pre-signed URLs (PUT) and view objects (GET/HEAD).

Usage (from the backend/ directory):
    python -m scripts.set_r2_cors

Origins are taken from ALLOWED_ORIGINS plus localhost dev ports.
Run once per bucket (and again if your frontend origins change).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import settings
from app.utils.storage import ensure_bucket_cors


def main() -> None:
    origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
    # Always include common local dev origins.
    for dev in (
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:3001", "http://127.0.0.1:3001",
    ):
        if dev not in origins:
            origins.append(dev)

    if not settings.r2_enabled:
        print("[SKIP] R2 is not configured (r2_enabled=False). Nothing to do.")
        return

    print(f"Setting CORS on bucket '{settings.r2_bucket}' for origins:")
    for o in origins:
        print(f"   - {o}")
    res = ensure_bucket_cors(origins)
    print("[OK]  ", res)


if __name__ == "__main__":
    main()

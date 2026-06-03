"""
Object storage helper.

Uploads files to Cloudflare R2 (S3-compatible) when R2 credentials are
configured; otherwise falls back to local disk storage under uploads/.

Public functions
----------------
    upload_bytes(contents, filename, content_type) -> dict
        Returns {"url", "key", "filename", "size", "backend"}

The local fallback writes to <repo_root>/uploads/ and builds a public URL
from settings.public_base_url (served by main.py's StaticFiles mount).
"""

import logging
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# Local fallback directory — repo_root/uploads/
_UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Lazily-created boto3 client (reused across calls)
_r2_client = None


def _get_r2_client():
    global _r2_client
    if _r2_client is None:
        import boto3
        from botocore.config import Config

        _r2_client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
            region_name="auto",
        )
    return _r2_client


def _safe_key(filename: str, prefix: str = "attachments") -> str:
    """Build a collision-proof object key, preserving the file extension."""
    suffix = Path(filename or "file").suffix.lower()
    return f"{prefix}/{uuid.uuid4().hex}{suffix}"


def upload_bytes(
    contents: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
    prefix: str = "attachments",
) -> dict:
    """
    Upload raw bytes and return file metadata including a public URL.

    Uses R2 when configured, else local disk.
    """
    original_name = Path(filename or "file").name
    size = len(contents)

    if settings.r2_enabled:
        key = _safe_key(original_name, prefix)
        try:
            client = _get_r2_client()
            client.put_object(
                Bucket=settings.r2_bucket,
                Key=key,
                Body=contents,
                ContentType=content_type,
                # Make object readable when bucket has public access enabled
                ContentDisposition=f'inline; filename="{original_name}"',
            )
            base = (settings.r2_public_url or "").rstrip("/")
            url = f"{base}/{key}" if base else key
            return {
                "url": url,
                "key": key,
                "filename": original_name,
                "size": size,
                "content_type": content_type,
                "backend": "r2",
            }
        except Exception as exc:  # noqa: BLE001 — fall back to disk on any R2 error
            logger.error("R2 upload failed, falling back to local disk: %s", exc)

    # ── Local disk fallback ────────────────────────────────────────────────────
    suffix = Path(original_name).suffix.lower()
    unique_name = f"{uuid.uuid4().hex}{suffix}"
    dest = _UPLOAD_DIR / unique_name
    dest.write_bytes(contents)
    base = settings.public_base_url.rstrip("/")
    return {
        "url": f"{base}/uploads/{unique_name}",
        "key": unique_name,
        "filename": original_name,
        "size": size,
        "content_type": content_type,
        "backend": "local",
    }

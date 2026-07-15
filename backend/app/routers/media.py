"""
Media upload router.

POST /api/v1/media/upload
  - Accepts a multipart file upload (images/video)
  - Saves it to <repo_root>/uploads/
  - Returns a publicly-accessible URL built from settings.public_base_url
    so Instagram / Facebook can fetch it when creating a media container.
"""

import uuid
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.config import settings
from app.utils.response import success_response, error_response
from app.utils.storage import upload_bytes, presign_put

router = APIRouter(prefix="/api/v1/media", tags=["media"])

# Max attachment size: 25 MB per file
MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

# Max size for direct (pre-signed) browser → R2 uploads: 1 GB per file
MAX_DIRECT_BYTES = 1024 * 1024 * 1024

# Directory where files are stored — two levels up from this file → repo_root/uploads/
UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Max file size: 50 MB
MAX_SIZE_BYTES = 50 * 1024 * 1024

ALLOWED_MIME_PREFIXES = ("image/", "video/")


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload an image or video file and receive a public URL.

    The URL is built as:  {PUBLIC_BASE_URL}/uploads/{filename}
    This URL must be reachable by Instagram/Facebook servers.
    In development, set PUBLIC_BASE_URL to your ngrok static domain.
    """
    # ── Validate MIME type ─────────────────────────────────────────────────────
    content_type = file.content_type or ""
    if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        return error_response(
            f"Unsupported file type '{content_type}'. Only images and videos are allowed.",
            status_code=415,
        )

    # ── Read & size-check ──────────────────────────────────────────────────────
    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        return error_response(
            f"File too large ({len(contents) // (1024*1024)} MB). Maximum is 50 MB.",
            status_code=413,
        )

    # ── Derive a safe filename ─────────────────────────────────────────────────
    original_name = Path(file.filename or "upload").name
    suffix = Path(original_name).suffix.lower() or _mime_to_ext(content_type)
    unique_name = f"{uuid.uuid4().hex}{suffix}"
    dest = UPLOAD_DIR / unique_name

    # ── Write to disk ──────────────────────────────────────────────────────────
    await run_in_threadpool(_write_file, dest, contents)

    # ── Build public URL ───────────────────────────────────────────────────────
    base = settings.public_base_url.rstrip("/")
    public_url = f"{base}/uploads/{unique_name}"

    return success_response(
        data={"url": public_url, "filename": unique_name, "size": len(contents)},
        message="File uploaded successfully",
        status_code=201,
    )


@router.post("/upload-attachments")
async def upload_attachments(
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload one or more task attachments (any file type) to R2 / local storage.

    Returns a list of {url, key, filename, size, content_type, backend}.
    Used by the task composer for multi-file attachments.
    """
    if not files:
        return error_response("No files provided", status_code=400)
    if len(files) > 10:
        return error_response("Maximum 10 files per upload", status_code=400)

    results = []
    for f in files:
        contents = await f.read()
        if len(contents) > MAX_ATTACHMENT_BYTES:
            return error_response(
                f"'{f.filename}' is too large ({len(contents)//(1024*1024)} MB). Maximum is 25 MB per file.",
                status_code=413,
            )
        meta = await run_in_threadpool(
            upload_bytes,
            contents,
            f.filename or "file",
            f.content_type or "application/octet-stream",
        )
        results.append(meta)

    return success_response(
        data=results,
        message=f"{len(results)} file{'s' if len(results) != 1 else ''} uploaded",
        status_code=201,
    )


# ── Direct (pre-signed) browser → R2 uploads ──────────────────────────────────

class PresignFile(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"
    size: int = 0


class PresignRequest(BaseModel):
    files: list[PresignFile]
    prefix: str = "attachments"


@router.post("/presign")
async def presign_uploads(
    body: PresignRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Issue short-lived pre-signed PUT URLs so the browser can upload files
    **directly** to R2 (bytes never transit this backend → supports up to 1 GB).

    Body: {"files": [{filename, content_type, size}], "prefix"?}
    Returns a list of {upload_url, method, headers, public_url, key,
    filename, content_type, backend} — one per file, in order.
    """
    if not body.files:
        return error_response("No files provided", status_code=400)
    if len(body.files) > 20:
        return error_response("Maximum 20 files per request", status_code=400)

    results = []
    for f in body.files:
        if f.size and f.size > MAX_DIRECT_BYTES:
            mb = f.size // (1024 * 1024)
            return error_response(
                f"'{f.filename}' is too large ({mb} MB). Maximum is 1 GB per file.",
                status_code=413,
            )
        meta = await run_in_threadpool(
            presign_put,
            f.filename or "file",
            f.content_type or "application/octet-stream",
            body.prefix or "attachments",
        )
        results.append(meta)

    return success_response(data=results, message="Pre-signed upload URLs issued")


@router.put("/local-blob/{key:path}")
async def local_blob_put(key: str, request: Request):
    """
    Local-disk fallback target for pre-signed uploads when R2 is not configured
    (development only). Stores the raw request body under uploads/. No auth —
    the pre-signed key is the capability. Never used when R2 is enabled.
    """
    if settings.r2_enabled:
        return error_response("Not available when R2 is enabled", status_code=404)
    body = await request.body()
    if len(body) > MAX_DIRECT_BYTES:
        return error_response("File too large (max 1 GB)", status_code=413)
    name = Path(key).name
    dest = UPLOAD_DIR / name
    await run_in_threadpool(_write_file, dest, body)
    return success_response(data={"key": key}, message="Stored")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _write_file(dest: Path, contents: bytes) -> None:
    dest.write_bytes(contents)


def _mime_to_ext(mime: str) -> str:
    mapping = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
    }
    return mapping.get(mime, ".bin")

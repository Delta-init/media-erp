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

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.middleware.auth import get_current_user
from app.config import settings
from app.utils.response import success_response, error_response
from app.utils.storage import upload_bytes

router = APIRouter(prefix="/api/v1/media", tags=["media"])

# Max attachment size: 25 MB per file
MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

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

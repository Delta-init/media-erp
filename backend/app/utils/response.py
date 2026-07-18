from typing import Any
from fastapi.responses import JSONResponse


def success_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200,
    meta: dict | None = None,
) -> JSONResponse:
    """
    Standard envelope: {success, message, data}.

    `meta` is optional and only added when supplied, so existing clients that
    read `data` are unaffected. Used for pagination/limit info such as
    {"total", "returned", "truncated"}.
    """
    body: dict[str, Any] = {"success": True, "message": message, "data": data}
    if meta is not None:
        body["meta"] = meta
    return JSONResponse(status_code=status_code, content=body)


def error_response(
    message: str = "An error occurred",
    status_code: int = 400,
    errors: Any = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "message": message, "errors": errors},
    )

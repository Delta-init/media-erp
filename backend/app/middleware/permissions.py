from fastapi import Depends, HTTPException, status

from app.middleware.auth import get_current_user

_PLAN_RANK = {"free": 0, "pro": 1, "enterprise": 2}


def require_plan(min_plan: str):
    """
    Returns a FastAPI dependency that allows access only if the user's
    plan rank is >= min_plan.  Usage:

        @router.post("/ai/query")
        async def ai_query(user: dict = Depends(require_plan("pro"))):
            ...
    """
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        user_rank = _PLAN_RANK.get(user.get("plan", "free"), 0)
        min_rank  = _PLAN_RANK.get(min_plan, 0)
        if user_rank < min_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires the '{min_plan}' plan or higher.",
            )
        return user
    return _dep


# ── RBAC permission helpers ────────────────────────────────────────────────────

def _has_permission(current_user: dict, module: str, action: str) -> bool:
    """Pure bool check — no exception raised."""
    role = current_user.get("_role")
    if role is None:
        return False
    if role.get("is_system_role") and role.get("role_name") == "Super Admin":
        return True
    perms = role.get("permissions", {}).get(module, {})
    return bool(perms.get(action))


def check_permission(module: str, action: str):
    """
    FastAPI dependency factory for RBAC.
    Usage:  Depends(check_permission("reports", "view"))
    Returns the current_user dict so endpoints can use it directly.
    """
    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if not _has_permission(current_user, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No '{action}' permission on '{module}'",
            )
        return current_user

    return dependency
